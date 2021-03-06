import Axios from 'axios';
// import Vue from 'vue';
import { State, EngineStatus, WorkflowInfo, WorkflowClassInfo, WorkflowRepo, StatesPrint, WorkflowFilter, ProcessorPool } from '../models/engine';
import { ConnectionSettings, ConnectionResult } from '../models/connectionSettings';
import moment from 'moment';
import { User } from '../models/user';
import { MBean } from '../models/mbeans';
import * as _ from 'lodash';
import { AuditTrailInstanceFilter } from '../models/auditTrail';

export class JmxService {
    getEngineStatus(mbeans: MBean[], user: User) {
        let requests = _.flatten(mbeans.map((mbean) => this.createEngineStatusRequest(mbean, user)));
        return Axios.post(process.env.API_NAME, requests, {
                auth: { username: user.name, password: user.password }
            })
            .then((response) => this.parseEngineStatusResponse(response, mbeans));
    }

    createEngineStatusRequest(mbean: MBean, user: User) {
        return [
            this.createEngineInfoRequest(mbean.connectionSettings, mbean), 
            this.createEngineActivityRequest(mbean.connectionSettings, mbean.name, user),
            this.createCountWFRequest(mbean.connectionSettings, mbean.name, [ State.ERROR, State.INVALID ])                
        ];
    }

    countWFRequest(connectionSettings, mbeanName, user: User, filter: WorkflowFilter) {
        return Axios.post(process.env.API_NAME, this.createCountWFRequest(connectionSettings, mbeanName, filter.states, filter), {
            auth: { username: user.name, password: user.password }
        })
        .then(this.parseCountWFRequest)
        .catch(error => {
            console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error fetching Engine Status:', error);
        });
    }

    countGroupWFRequest(mbeans: MBean[], length: number, user: User, state: State) {
        let requests = [];
        this.createGroupCountRequest(user, mbeans, [ state ]).map((request) => {
            requests.push(request);
        });
        
        return Axios.post(process.env.API_NAME, requests, {
                auth: { username: user.name, password: user.password }
            })
            .then((response) => this.parseGroupWFCountResponse(response, length))
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error counting Groups:', error);
            });
    }

    getChartCounts(mbean: MBean, user: User) {
        return Axios.post(process.env.API_NAME, [
                this.createCountWFRequest(mbean.connectionSettings, mbean.name, [ State.RUNNING ]),                
                this.createCountWFRequest(mbean.connectionSettings, mbean.name, [ State.WAITING ]),                
                this.createCountWFRequest(mbean.connectionSettings, mbean.name, [ State.FINISHED ]),                
                this.createCountWFRequest(mbean.connectionSettings, mbean.name, [ State.DEQUEUED ]),                
                this.createCountWFRequest(mbean.connectionSettings, mbean.name, [ State.ERROR ]),               
                this.createCountWFRequest(mbean.connectionSettings, mbean.name, [ State.INVALID ])                
            ], {
                auth: { username: user.name, password: user.password }
            })
            .then(this.parseChartCountResponse)
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error counting Charts:', error);
            });
    }

    getGroupChartCounts(mbeans: MBean[], length: number, user: User) {
        let requests = [];
        this.createGroupCountRequest(user, mbeans, [ State.RUNNING ]).map((request) => {
            requests.push(request);
        });
        this.createGroupCountRequest(user, mbeans, [ State.DEQUEUED ]).map((request) => {
            requests.push(request);
        });

        requests.push(this.createCountWFRequest(mbeans[0].connectionSettings, mbeans[0].name, [ State.WAITING ]));
        requests.push(this.createCountWFRequest(mbeans[0].connectionSettings, mbeans[0].name, [ State.FINISHED ]));
        
        requests.push(this.createCountWFRequest(mbeans[0].connectionSettings, mbeans[0].name, [ State.ERROR ]));
        requests.push(this.createCountWFRequest(mbeans[0].connectionSettings, mbeans[0].name, [ State.INVALID ]));
        
        return Axios.post(process.env.API_NAME, requests, {
                auth: { username: user.name, password: user.password }
            })
            .then((response) => this.parseGroupChartCountResponse(response, length))
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error counting group charts:', error);
            });
    }

    createGroupCountRequest(user: User, mbeans: MBean[], state: State[]) {
        let requests = mbeans.map((bean) => {
            return this.createCountWFRequest(bean.connectionSettings, bean.name, state);
        });
        return requests;
    }

    parseGroupWFCountResponse = (response, length) => {
        let count = 0;
        for (let i = 0; i < length; i++) {
            count += response.data[i].value;
        }
        return count;
    }

    parseGroupChartCountResponse = (response, length) => {
        let counter = length;
        let running = 0;
        let dequeued = 0;
        let otherValues = [];

        for (let i = 0; i < counter; i++) {
            running = running + response.data[i].value;
        }
        for (let i = counter; i < (counter * 2); i++) {
            dequeued = dequeued + response.data[i].value;
        }
        for (let i = (counter * 2); i < response.data.length; i++) {
            otherValues.push(response.data[i].value);
        }

        return new StatesPrint(new Date(response.data[0].timestamp * 1000), 
            running, otherValues[0], otherValues[1], dequeued, otherValues[2], otherValues[3]);
    }

    getConnectionResults(connectionSettingsList: ConnectionSettings[], user: User): Promise<void | ConnectionResult[]> {
        return Axios.post(process.env.API_NAME,
                connectionSettingsList.map( connectionSettings => this.createMBeansListRequest(connectionSettings)), 
                { auth: { username: user.name, password: user.password } })
            .then((response) => {
                if (!response || !response.data
                    || response.data.length === 0) {
                    console.log('Invalid responce:', response);          
                    throw new Error('invalid response!');
                }

                let connectionResults: ConnectionResult[] = connectionSettingsList.map((connectionSettings, i) => {
                    let connectionResult: ConnectionResult; 

                    if (this.isSubResponseValid(response.data[i]) && response.data[i].value['copper.engine']) {
                        let engines = response.data[i].value['copper.engine'];
                        let mbeanNames = Object.keys(engines);
                        let mbeans = mbeanNames.map((mbean) => new MBean(mbean, Object.keys(engines[mbean].attr), connectionSettings));

                        connectionResult = new ConnectionResult(connectionSettings, mbeans);
                    } else {
                        connectionResult = new ConnectionResult(connectionSettings, []);
                        if (response.data[i] !== undefined && response.data[i].status === 403) {
                            connectionResult.error = 'Authentication failed! Credentials required.';
                        } else {
                            connectionResult.error = response.data[i].error ? response.data[i].error : 'Unnable to connect';
                        }
                    }

                    if (this.isSubResponseValid(response.data[i]) && response.data[i].value['copper.audittrail']) {
                        let auditTrails = response.data[i].value['copper.audittrail'];
                        let mbeanNames = Object.keys(auditTrails);

                        connectionResult.auditTrailsMBean = mbeanNames.map((bean) => {
                        return new MBean('copper.audittrail:' + bean, [], connectionSettings);
                        });

                    }

                    return connectionResult;
                });

                return connectionResults;
            }).catch(error => {
                console.log('Error', error);
            });
    }

    // TODO logout if wrong credentials...
    getWorkflows(connectionSettings: ConnectionSettings, mbean: string, user: User , max: number = 0, offset: number = 0, filter: WorkflowFilter) {
        return Axios.post(process.env.API_NAME, [
                this.createQueryWFRequest(connectionSettings, mbean, max, offset, filter)
            ], {
                auth: { username: user.name, password: user.password }
            })
            .then(this.parseWorkflowsResponse)
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error fetching Broken Workflows:', error);
            });
    }

    queryObjectState(connectionSettings: ConnectionSettings, bean: MBean, user: User, id: string) {
        return Axios.post(process.env.API_NAME, [
            this.createQueryObjectStateRequest(connectionSettings, bean.name, id)
        ], {
            auth: { username: user.name, password: user.password }
        })
        .then(this.parseObjectStateResponse)
        .catch(error => {
            console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error fetching Broken Workflows:', error);
        });
    }

    parseObjectStateResponse(response) {
        return response.data[0].value;
    }

    getWfRepoDetails(connectionSettings: ConnectionSettings, mbean: string, user: User) {
        return Axios.post(process.env.API_NAME, [
            this.createWfRepoInfoRequest(connectionSettings, mbean)
            ], {
                auth: { username: user.name, password: user.password }
            })
            .then(this.parseWfRepoInfoResponse)
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error fetching Workflow Repo details:', error);
            });
    }

    getWfRepo(connectionSettings: ConnectionSettings, mbean: string, user: User, max: number, offset: number) {
        return Axios.post(process.env.API_NAME, [
            this.createWfRepoRequest(connectionSettings, mbean, max, offset)
            ], {
                auth: { username: user.name, password: user.password }
            })
            .then(this.parseWfRepoResponse)
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error fetching Workflow Repo:', error);
            });
    }

    getSourceCode(connectionSettings: ConnectionSettings, user: User, mbean: string, classname: String) {
        return Axios.post(process.env.API_NAME, [
            this.createSourceCodeRequest(connectionSettings, mbean, classname)
            ], {
                auth: { username: user.name, password: user.password }
            })
            .then(this.parseSourceCodeResponse)
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error fetching Source Code:', error);
            });
    }

    getProcessorPools(connectionSettings: ConnectionSettings, mbeans: string[], engineType: string, user: User) {
        let requests = mbeans.map((mbean) => { return this.createGetProcessorPoolsRequest(connectionSettings, mbean, engineType); });
        return Axios.post(process.env.API_NAME, requests, {
                    auth: { username: user.name, password: user.password }
                })
            .then((response) => this.parseProcessorPoolsResponse(response, mbeans))
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error fetching Processor Pools:', error);
            });
    }

    resume(connectionSettings: ConnectionSettings, user: User, mbean: string) {
        return Axios.post(process.env.API_NAME, [
            this.createPoolExecRequest(connectionSettings, mbean, { operation: 'resume()' })
        ], {
            auth: { username: user.name, password: user.password }
        })
        .then(this.parseVoidResponse)
        .catch(error => {
            console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error resuming:', error);
        });
    }

    restartAll(connectionSettings: ConnectionSettings, mbean: string, user: User) {
        return Axios.post(process.env.API_NAME, [
                    this.createJmxExecRequest(connectionSettings, mbean, { operation: 'restartAll()' })
                ], {
                    auth: { username: user.name, password: user.password }
                })
            .then(this.parseVoidResponse)
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error restarting broken workflows:', error);
            });
    }

    suspend(connectionSettings: ConnectionSettings, user: User, mbean: string) {
        return Axios.post(process.env.API_NAME, [
            this.createPoolExecRequest(connectionSettings, mbean, { operation: 'suspend()' })
        ], {
            auth: { username: user.name, password: user.password }
        })
        .then(this.parseVoidResponse)
        .catch(error => {
            console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error suspending:', error);
        });
    }

    resumeDeque(connectionSettings: ConnectionSettings, user: User, mbean: string) {
        return Axios.post(process.env.API_NAME, [
            this.createPoolExecRequest(connectionSettings, mbean, { operation: 'resumeDeque()' })
        ], {
            auth: { username: user.name, password: user.password }
        })
        .then(this.parseVoidResponse)
        .catch(error => {
            console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error restarting resuming dequed:', error);
        });
    }

    suspendDeque(connectionSettings: ConnectionSettings, user: User, mbean: string) {
        return Axios.post(process.env.API_NAME, [
            this.createPoolExecRequest(connectionSettings, mbean, { operation: 'suspendDeque()' })
        ], {
            auth: { username: user.name, password: user.password }
        })
        .then(this.parseVoidResponse)
        .catch(error => {
            console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error suspending dequed:', error);
        });
    }

    restart(connectionSettings: ConnectionSettings, mbean: string, workflowId: string, user: User) {
        return Axios.post(process.env.API_NAME, 
                [ this.createJmxExecRequest(connectionSettings, mbean, { operation: 'restart', arguments: [ workflowId ] }) ], {
                    auth: { username: user.name, password: user.password }
                })
            .then(this.parseVoidResponse)
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error restarting broken workflow:', error);
            });
    }

    deleteWorkflow(connectionSettings: ConnectionSettings, mbean: string, workflowId: string, wfType: string, user: User) {
        if (wfType === 'waiting') {
            return Axios.post(process.env.API_NAME, 
                [ this.createJmxExecRequest(connectionSettings, mbean, { operation: 'deleteWaiting', arguments: [ workflowId ] }) ], {
                    auth: { username: user.name, password: user.password }
                })
            .then(this.parseVoidResponse)
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error deleting broken workflow:', error);
            });
        } else {
            return Axios.post(process.env.API_NAME, 
                    [ this.createJmxExecRequest(connectionSettings, mbean, { operation: 'deleteBroken', arguments: [ workflowId ] }) ], {
                        auth: { username: user.name, password: user.password }
                    })
                .then(this.parseVoidResponse)
                .catch(error => {
                    console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error deleting broken workflow:', error);
                });
        }
    }

    deleteFiltered(connectionSettings: ConnectionSettings, mbean: string, user: User , max: number = 0, offset: number = 0, filter: WorkflowFilter) {
        return Axios.post(process.env.API_NAME, 
            [ this.createJmxExecRequest(connectionSettings, mbean, { operation: 'deleteFiltered(javax.management.openmbean.CompositeData)', arguments: [this.createWorkflowFilter(connectionSettings, filter.states, max, offset, filter)] }) ], {
                auth: { username: user.name, password: user.password }
            })
        .then(this.parseVoidResponse)
        .catch(error => {
            console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error deleting filtered workflows:', error);
        });    
    }   

    restartFiltered(connectionSettings: ConnectionSettings, mbean: string, user: User , max: number = 0, offset: number = 0, filter: WorkflowFilter) {
        return Axios.post(process.env.API_NAME, [
            this.createJmxExecRequest(connectionSettings, mbean, { operation: 'restartFiltered(javax.management.openmbean.CompositeData)', arguments: [this.createWorkflowFilter(connectionSettings, filter.states, max, offset, filter)]  })
            ], {
                auth: { username: user.name, password: user.password }
            })
        .then(this.parseVoidResponse)
        .catch(error => {
            console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error restarting filtered workflows:', error);
        });
    }

    getAuditTrails(auditTrailMBean: MBean, user: User, auditTrailFilter: AuditTrailInstanceFilter) {
        return Axios.post(process.env.API_NAME, [
            {
                type: 'EXEC',
                mbean: auditTrailMBean.name,
                operation: 'getAuditTrails(javax.management.openmbean.CompositeData)',
                arguments: [ auditTrailFilter ],
                target: this.getTarget(auditTrailMBean.connectionSettings),
            }
            ], {
                auth: { username: user.name, password: user.password }
            })
            .then(this.parseAuditTrailResponse)
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error fetching Audit Trails:', error);
            });
    }

    // TODO consider merge  base with getAuditTrails to have less code duplication
    countAuditTrails(auditTrailMBean: MBean, user: User, auditTrailFilter: AuditTrailInstanceFilter) { 
        return Axios.post(process.env.API_NAME, [
            {
                type: 'EXEC',
                mbean: auditTrailMBean.name,
                operation: 'countAuditTrails(javax.management.openmbean.CompositeData)',
                arguments: [ auditTrailFilter ],
                target: this.getTarget(auditTrailMBean.connectionSettings),
            }
            ], {
                auth: { username: user.name, password: user.password }
            })
            .then(this.parseAuditTrailResponse)
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error counting Audit Trails:', error);
            });
    }

    // TODO consider merge  base with getAuditTrails to have less code duplication
    getAuditTrailMessage(auditTrailMBean: MBean, user: User, id: number) { 
        return Axios.post(process.env.API_NAME, [
            {
                type: 'EXEC',
                mbean: auditTrailMBean.name,
                operation: 'getMessageString',
                arguments: [ id ],
                target: this.getTarget(auditTrailMBean.connectionSettings),
            }
            ], {
                auth: { username: user.name, password: user.password }
            });
            // .then(this.parseAuditTrailResponse)
            // .catch(error => {
            //     console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error fetching Broken Workflows:', error);
            // });
    }

    private buildRestartAllRequest = (connectionSettings: ConnectionSettings, mbean: string) => [
        this.createJmxExecRequest(connectionSettings, mbean, {
            operation: 'restartAll()',
            arguments: [], 
        })
    ]

    private createSourceCodeRequest(connectionSettings: ConnectionSettings, mbean: string, classname: String) {
        return {
            type: 'EXEC',
            mbean: mbean,
            operation: 'getWorkflowInfo',
            arguments: [classname],
            target: this.getTarget(connectionSettings)
        };
    }

    private createWfRepoRequest(connectionSettings: ConnectionSettings, mbean: string, max: number, offset: number) {
        return {
            type: 'EXEC',
            mbean: mbean,
            operation: 'queryWorkflowsSubset',
            arguments: [max, offset],
            target: this.getTarget(connectionSettings)
        };
    }

    private createWfRepoInfoRequest(connectionSettings: ConnectionSettings, mbean: string) {
        return {
            type: 'read',
            mbean: mbean,
            attribute: ['Description', 'LastBuildResults', 'SourceArchiveUrls', 'SourceDirs', 'WorkflowRepoSize'],            
            target: this.getTarget(connectionSettings)
        };
    }
    private createEngineInfoRequest(connectionSettings: ConnectionSettings, mbean: MBean) {
        let attributes = ['EngineId', 'EngineType', 'State', 'WorkflowRepository', 'ProcessorPools'];
        if (mbean.atts.indexOf('DBStorage') >= 0) {
            attributes.push('DBStorage');
        }
        if (mbean.atts.indexOf('EngineClusterId') >= 0) {
            attributes.push('EngineClusterId');
        }
        return {
            type: 'read',
            mbean: mbean.name,
            attribute: attributes,
            target: this.getTarget(connectionSettings)
        };
    }

    private getTarget( connectionSettings: ConnectionSettings ) {
        return {
            url: `service:jmx:rmi:///jndi/rmi://${connectionSettings.host}:${connectionSettings.port}/jmxrmi`,
            user: connectionSettings.username,
            password: connectionSettings.password,
            // connectionTimeout: 5,
            // socketTimeout: 5
        };
    }

    private createMBeansListRequest(connectionSettings: ConnectionSettings) {
        return {
            type: 'LIST',
            target: this.getTarget(connectionSettings),
            // connectionTimeout: 5,
            // socketTimeout: 5
        };
    }

    private createGetProcessorPoolsRequest(connectionSettings: ConnectionSettings, mbean: string, engineType: string) {
        let attributes = ((engineType === 'persistent') ? ['Id', 'ProcessorPoolState', 'ThreadPriority', 'UpperThreshold', 'LowerThreshold', 'NumberOfThreads', 'NumberOfActiveThreads'] : ['Id', 'ProcessorPoolState', 'ThreadPriority', 'MemoryQueueSize', 'QueueSize', 'NumberOfThreads', 'NumberOfActiveThreads']);
        return {
            type: 'READ',
            mbean: mbean,
            attribute: attributes,
            target: this.getTarget(connectionSettings)
        };
    }

    private createQueryWFRequest(connectionSettings: ConnectionSettings, mbean: string, max: number, offset: number, filter: WorkflowFilter) {
        return this.createJmxExecRequest(connectionSettings, mbean, {
            operation: 'queryWorkflowInstances(javax.management.openmbean.CompositeData)',
            arguments: [this.createWorkflowFilter(connectionSettings, filter.states, max, offset, filter)], // get workflows with status Invalid
        });
    }

    private createQueryObjectStateRequest(connectionSettings: ConnectionSettings, bean: string, id: string) {

        return {
            type: 'EXEC',
            mbean: bean,
            operation: 'queryObjectState',
            arguments: [id],
            target: this.getTarget(connectionSettings)
        };
    }

    private createCountWFRequest(connectionSettings: ConnectionSettings, mbean: string, states: State[], filter: WorkflowFilter = new WorkflowFilter) {
        return this.createJmxExecRequest(connectionSettings, mbean, {
            operation: 'countWorkflowInstances(javax.management.openmbean.CompositeData)',
            arguments: [this.createWorkflowFilter(connectionSettings, states, 0, 0, filter)], // get workflows with status Invalid
        });
    }

    private createEngineActivityRequest(connectionSettings: ConnectionSettings, mbean: string, user: User) {
        return this.createJmxExecRequest(connectionSettings, mbean, {
            operation: 'queryEngineActivity',
            arguments: [5], // fetch info for last N minutes
        });
    }

    private createWorkflowFilter(connectionSettings: ConnectionSettings, states: State[], max: number = 0, offset: number = 0, filter: WorkflowFilter = new WorkflowFilter) {
        let createTo = new Date().getTime();
        let modTo = new Date().getTime();
        if (filter.createTo != null) {
            createTo = filter.createTo;
        }
        if (filter.modTo != null) {
            modTo = filter.modTo;
        }
        return { 
            'states': states.map((state) => State[state]),
            'lastModTS': { 'from': filter.modFrom, 'to': filter.modTo}, 
            'creationTS': { 'from': filter.createFrom, 'to': filter.createTo}, 
            'processorPoolId': null, 
            'workflowClassname': filter.classname, 
            'max': max,
            'offset': offset
        };
    }

    private createJmxExecRequest(connectionSettings, mbean: string, uniquePart: {}) {
        return Object.assign(this.createJmxExecRequstBase(connectionSettings, mbean), uniquePart);
    }

    private createPoolExecRequest(connectionSettings, mbean, uniquePart: {}) {
        return Object.assign(this.createJmxExecRequstBase(connectionSettings, mbean), uniquePart);
    }

    private createJmxExecRequstBase(connectionSettings: ConnectionSettings, mbean: string) {
        return {
            type: 'EXEC',
            mbean: mbean,
            target: this.getTarget(connectionSettings)
        };
    }

    parseCountWFRequest(response) {
        if (!response || !response.data 
            || response.data.length < 1
            || response.data.error) {
            console.log('Invalid responce:', response); 
            throw new Error('invalid response!');
        }
        return response.data.value;
    }

    private parseProcessorPoolsResponse = (response, mbeans) => {
        if (!response || !response.data 
            || response.data.length < 1
            || response.data.error) {
            console.log('Invalid responce:', response); 
            throw new Error('invalid response!');
        }
        let pools = response.data.map((pool, index) => {
            let newPool = new ProcessorPool (
                pool.value.Id,
                pool.value.ProcessorPoolState,
                pool.value.ThreadPriority,
                pool.value.QueueSize,
                pool.value.MemoryQueueSize,
                pool.value.DequeBulkSize,
                pool.value.EmptyQueueWaitMSec,
                pool.value.UpperThresholdReachedWaitMSec,            
                pool.value.UpperThreshold,
                pool.value.LowerThreshold,
                pool.value.NumberOfThreads,
                pool.value.NumberOfActiveThreads, 
                mbeans[index]
            );
            return newPool;
        });
        return pools;
    }

    private parseWfRepoInfoResponse = (response) => {
        if (!response || !response.data 
            || response.data.length < 1
            || response.data[0].error) {
            console.log('Invalid responce:', response); 
            throw new Error('invalid response!');
        }
        let wfRepo = new WorkflowRepo(
            response.data[0].value.Description,
            response.data[0].value.SourceDirs[0],
            response.data[0].value.LastBuildResults,
            response.data[0].value.WorkflowRepoSize,
            []
        );
        return wfRepo;
    }

    private parseWfRepoResponse = (response) => {
        if (!response || !response.data 
            || response.data.length < 1
            || response.data[0].error) {
            console.log('Invalid responce:', response); 
            throw new Error('invalid response!');
        }
        return response.data[0].value.map((workflow) => {
            return new WorkflowClassInfo(
                workflow.classname,
                workflow.alias,
                workflow.majorVersion,
                workflow.minorVersion,
                workflow.patchLevel,
                workflow.serialversionuid,
                workflow.sourceCode
            );
        });
    }

    private parseAuditTrailResponse = (response) => {
        if (!response || !response.data 
            || response.data.length < 1
            || response.data[0].error) {
            console.log('Invalid responce for Audit Trail:', response); 
            throw new Error('invalid response for Audit Trail!');
        }
        return response.data[0].value;
    }

    private parseVoidResponse = (response): boolean => {
        if (!response || !response.data 
            || response.data.length < 1
            || response.data[0].error) {
            console.log('Invalid response:', response); 
            throw new Error('invalid response!');
        }

        return response.data[0].status === 200;
    }

    private parseEngineStatusResponse = (response, mbeans: MBean[]): EngineStatus[] => {
        if (!response || !response.data || response.data.length < 3) {
            console.log('Invalid responce:', response);          
            throw new Error('invalid response from JMX!');
        }

        return _.chunk(response.data, 3).map((data, index) => this.parseEngineStatusData(data, index, mbeans[index]));
    }

    enginesIdMap: Map<String, number> = new Map<String, number>(); 
    private parseEngineStatusData = (data, id: number, mbean: MBean): EngineStatus => {
        if (data.length < 3
            || !this.isSubResponseValid(data[0])
            || !this.isSubResponseValid(data[1])
            || !this.isSubResponseValid(data[2])
        ) {
            console.error('Invalid engine status Data', data);
            let errorInstance = data.find(el => el.error);
            throw new Error(errorInstance ? errorInstance.error : 'Engine Status data is Invalid');
        }

        let key = mbean.name + '_' + mbean.connectionSettings.toString();
        let engineId: number = this.enginesIdMap.get(key);
        
        if (engineId === undefined) {
            engineId = this.enginesIdMap.size;
            this.enginesIdMap.set(key, engineId);
        }

        return new EngineStatus(
            engineId,
            data[1].value.startupTS,
            data[1].value.lastActivityTS,
            data[0].value.EngineClusterId,
            data[0].value.EngineId,
            data[0].value.EngineType,
            data[1].value.countWfiLastNMinutes,
            data[0].value.State.toLowerCase(),
            data[2].value,
            mbean,
            data[0].value.DBStorage ? data[0].value.DBStorage.objectName : null,
            data[0].value.WorkflowRepository.objectName,
            data[0].value.ProcessorPools.map((mbean) => mbean.objectName)            
        );
    }

    private parseSourceCodeResponse = (response): String => {
        if (!response || !response.data 
            || response.data.length < 1
            || response.data[0].error) {
            console.log('Invalid responce:', response); 
            throw new Error('invalid response from JMX!');
        }
        return response.data[0].value.sourceCode;
    }

    private parseChartCountResponse = (response): StatesPrint => {
        if (!response || !response.data
            || response.data.length < 5
            || !this.isSubResponseValid(response.data[0])
            || !this.isSubResponseValid(response.data[1])
            || !this.isSubResponseValid(response.data[2])
            || !this.isSubResponseValid(response.data[3])
            || !this.isSubResponseValid(response.data[4])
            || !this.isSubResponseValid(response.data[5])
        ) {
            console.log('Invalid responce:', response);          
            throw new Error('invalid response!');
        }

        return new StatesPrint(new Date(response.data[0].timestamp * 1000),
        response.data[0].value, response.data[1].value, response.data[2].value, response.data[3].value, response.data[4].value, response.data[5].value);
    }

    private parseWorkflowsResponse = (response): WorkflowInfo[] => {
        if (!response || !response.data
            || response.data.length < 1
            || !this.isSubResponseValid(response.data[0])
        ) {
            console.log('Invalid responce:', response);          
            throw new Error('invalid response!');
        }

        return response.data[0].value.map(info => Object.assign(new WorkflowInfo(), info));
    }

    private isSubResponseValid(subResponse) {
        if (subResponse !== undefined) {
            return !subResponse.error && (subResponse.value !== null ||  subResponse.value !== undefined);
        } else {
            return false;
        }
    }
}
