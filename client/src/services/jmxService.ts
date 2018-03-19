import Axios from 'axios';
// import Vue from 'vue';
import { State, EngineStatus, WorkflowInfo, WorkflowClassInfo, WorkflowRepo, StatesPrint } from '../models/engine';
import { ConnectionSettings } from '../models/connectionSettings';
import moment from 'moment';
import { User } from '../models/user';
import { MBeans } from '../models/mbeans';
import * as _ from 'lodash';

export class JmxService {
    getEngineStatus(connectionSettings: ConnectionSettings, mbeans: MBeans, user: User) {
        let requests = _.flatten(mbeans.engineMBeans.map((mbean) => this.createEngineStatusRequest(connectionSettings, mbean)));
        return Axios.post(process.env.API_NAME, requests, {
                auth: { username: user.name, password: user.password }
            })
            .then((response) => this.parseEngineStatusResponse(response, mbeans.engineMBeans.length))
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error fetching Engine Status:', error);
            });
    }

    createEngineStatusRequest(connectionSettings, mbean) {
        return [
            this.createEngineInfoRequest(connectionSettings, mbean), 
            this.createEngineActivityRequest(connectionSettings, mbean),
            this.createCountWFRequest(connectionSettings, mbean, [ State.ERROR, State.INVALID ])                
        ];
    }

    getChartCounts(connectionSettings: ConnectionSettings, mbean: string, user: User) {
        return Axios.post(process.env.API_NAME, [
                this.createCountWFRequest(connectionSettings, mbean, [ State.RUNNING ]),                
                this.createCountWFRequest(connectionSettings, mbean, [ State.WAITING ]),                
                this.createCountWFRequest(connectionSettings, mbean, [ State.FINISHED ]),                
                this.createCountWFRequest(connectionSettings, mbean, [ State.DEQUEUED ]),                
                this.createCountWFRequest(connectionSettings, mbean, [ State.ERROR ]),               
                this.createCountWFRequest(connectionSettings, mbean, [ State.INVALID ])                
            ], {
                auth: { username: user.name, password: user.password }
            })
            .then(this.parseChartCountResponse)
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error fetching Engine Status:', error);
            });
    }
    getMBeans(connectionSettings: ConnectionSettings, user: User) {
        return Axios.post(process.env.API_NAME, [
                this.createMBeansListRequest(connectionSettings)
            ], {
                auth: { username: user.name, password: user.password }
            })
            .then((response) => {
                if (!response || !response.data
                    || response.data.length < 1
                    || !this.isSubResponseValid(response.data[0])
                ) {
                    console.log('Invalid responce:', response);          
                    throw new Error('invalid response!');
                }
                
                return [Object.keys(response.data[0].value['copper.engine']), Object.keys(response.data[0].value['copper.workflowrepo'])];
            })
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error fetching Engine Status:', error);
            });
    }

    // TODO logout if wrong credentials...
    getBrokenWorkflows(connectionSettings: ConnectionSettings, mbean: string, user: User , max: number = 50, offset: number = 0) {
        return Axios.post(process.env.API_NAME, [
                this.createQueryBrokenWFRequest(connectionSettings, mbean, max, offset)
            ], {
                auth: { username: user.name, password: user.password }
            })
            .then(this.parseBrokenWorkflowsResponse)
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error fetching Broken Workflows:', error);
            });
    }

    getWfRepo(connectionSettings: ConnectionSettings, mbean: string, user: User) {
        return Axios.post(process.env.API_NAME, [
            this.createWfRepoRequest(connectionSettings, mbean)
            ], {
                auth: { username: user.name, password: user.password }
            })
            .then(this.parseWfRepoResponse)
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error fetching Broken Workflows:', error);
            });
    }

    getSourceCode(connectionSettings: ConnectionSettings, user: User, classname: String) {
        return Axios.post(process.env.API_NAME, [
            this.createSourceCodeRequest(connectionSettings, classname)
            ], {
                auth: { username: user.name, password: user.password }
            })
            .then(this.parseSourceCodeResponse)
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error fetching Broken Workflows:', error);
            });
    }

    private createSourceCodeRequest(connectionSettings: ConnectionSettings, classname: String) {
        return {
        type: 'EXEC',
        mbean: 'copper.workflowrepo:name=wfRepository',
        // mbean: 'copper.workflowrepo:name=workflowRepositoryMXBean',
        operation: 'getWorkflowInfo',
        arguments: [classname],
        target: { url: `service:jmx:rmi:///jndi/rmi://${connectionSettings.host}:${connectionSettings.port}/jmxrmi` },
        };
    }

    private parseSourceCodeResponse = (response): String => {
        if (!response || !response.data 
            || response.data.length < 1
            || response.data[0].error) {
            console.log('Invalid responce:', response); 
            throw new Error('invalid response!');
        }
        return response.data[0].value.sourceCode;
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

    deleteAll(connectionSettings: ConnectionSettings, mbean: string, workflows: WorkflowInfo[], user: User) {
        let requestList = workflows.map((workflow) => {
            return this.createJmxExecRequest(connectionSettings, mbean, { operation: 'deleteBroken', arguments: [ workflow.id ] });
        });
        
        return Axios.post(process.env.API_NAME, requestList, {
            auth: { username: user.name, password: user.password }
        })
            .then(this.parseVoidResponse)
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error restarting broken workflows:', error);
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

    deleteBroken(connectionSettings: ConnectionSettings, mbean: string, workflowId: string, user: User) {
        return Axios.post(process.env.API_NAME, 
                [ this.createJmxExecRequest(connectionSettings, mbean, { operation: 'deleteBroken', arguments: [ workflowId ] }) ], {
                    auth: { username: user.name, password: user.password }
                })
            .then(this.parseVoidResponse)
            .catch(error => {
                console.error('Can\'t connect to Jolokia server or Copper Engine app. Checkout if it\'s running. Error restarting broken workflow:', error);
            });
    }

    private buildRestartAllRequest = (connectionSettings: ConnectionSettings, mbean: string) => [
        this.createJmxExecRequest(connectionSettings, mbean, {
            operation: 'restartAll()',
            arguments: [], 
        })
    ]

    private createWfRepoRequest(connectionSettings: ConnectionSettings, mbean: string) {
        return {
            type: 'read',
            mbean: mbean,
            target: { url: `service:jmx:rmi:///jndi/rmi://${connectionSettings.host}:${connectionSettings.port}/jmxrmi` },
        };
    }
    private createEngineInfoRequest(connectionSettings: ConnectionSettings, mbean: string) {
        return {
            type: 'read',
            mbean: mbean,
            attribute: ['EngineId', 'EngineType', 'State', 'WorkflowRepository', 'ProcessorPools'],
            target: { url: `service:jmx:rmi:///jndi/rmi://${connectionSettings.host}:${connectionSettings.port}/jmxrmi` },
        };
    }

    private createMBeansListRequest(connectionSettings: ConnectionSettings) {
        return {
            type: 'LIST',
            target: { url: `service:jmx:rmi:///jndi/rmi://${connectionSettings.host}:${connectionSettings.port}/jmxrmi` },
        };
    }

    private createQueryBrokenWFRequest(connectionSettings: ConnectionSettings, mbean: string, max: number, offset: number) {
        return this.createJmxExecRequest(connectionSettings, mbean, {
            operation: 'queryWorkflowInstances(javax.management.openmbean.CompositeData)',
            arguments: [this.createWorkflowFilter(connectionSettings, [State.ERROR, State.INVALID], max, offset)], // get workflows with status Invalid
        });
    }

    private createCountWFRequest(connectionSettings: ConnectionSettings, mbean: string, states: State[]) {
        return this.createJmxExecRequest(connectionSettings, mbean, {
            operation: 'countWorkflowInstances(javax.management.openmbean.CompositeData)',
            arguments: [this.createWorkflowFilter(connectionSettings, states)], // get workflows with status Invalid
        });
    }

    private createEngineActivityRequest(connectionSettings: ConnectionSettings, mbean: string) {
        return this.createJmxExecRequest(connectionSettings, mbean, {
            operation: 'queryEngineActivity',
            arguments: [connectionSettings.fetchPeriod], // fetch info for last N minutes
        });
    }

    private createWorkflowFilter(connectionSettings: ConnectionSettings, states: State[], max: number = 50, offset: number = 0) {
        let now = new Date().getTime();
        // let fromTime = new Date(now - connectionSettings.fetchPeriod * 60 * 1000).getTime();
        return { 
            'states': states.map((state) => State[state]),
            'lastModTS': { 'from': null, 'to': now}, 
            'creationTS': { 'from': null, 'to': now}, 
            'processorPoolId': null, 
            'workflowClassname': null, 
            'max': max,
            'offset': offset
        };
    }

    private createJmxExecRequest(connectionSettings, mbean: string, uniquePart: {}) {
        return Object.assign(this.createJmxExecRequstBase(connectionSettings, mbean), uniquePart);
    }

    private createJmxExecRequstBase(connectionSettings: ConnectionSettings, mbean: string) {
        return {
            type: 'EXEC',
            mbean: mbean,
            target: {
                url: `service:jmx:rmi:///jndi/rmi://${connectionSettings.host}:${connectionSettings.port}/jmxrmi`
            }
        };
    }

    private parseWfRepoResponse = (response) => {
        if (!response || !response.data 
            || response.data.length < 1
            || response.data[0].error) {
            console.log('Invalid responce:', response); 
            throw new Error('invalid response!');
        }
        let wfArray: Array<WorkflowClassInfo> = response.data[0].value.Workflows.map((workflow) => {
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
        let wfRepo = new WorkflowRepo(
            response.data[0].value.Description,
            response.data[0].value.SourceDirs[0],
            wfArray
        );
        return wfRepo;
    }

    private parseVoidResponse = (response): boolean => {
        if (!response || !response.data 
            || response.data.length < 1
            || response.data[0].error) {
            console.log('Invalid responce:', response); 
            throw new Error('invalid response!');
        }

        return response.data[0].status === 200;
    }

    private parseEngineStatusResponse = (response, enginesCount: number): EngineStatus[] => {
        if (!response || !response.data || response.data.length < 3) {
            console.log('Invalid responce:', response);          
            throw new Error('invalid response!');
        }

        return _.chunk(response.data, 3).map((data, index) => this.parseEngineStatusData(data, index));
    }
    private parseEngineStatusData = (data, id: number): EngineStatus => {
        if (data.length < 3
            || !this.isSubResponseValid(data[0])
            || !this.isSubResponseValid(data[1])
            || !this.isSubResponseValid(data[2])
        ) {
            throw new Error('invalid engine data:!' + data);
        }

        return new EngineStatus(
            id,
            data[1].value.startupTS,
            data[1].value.lastActivityTS,
            data[0].value.EngineId,
            data[0].value.EngineType,
            data[1].value.countWfiLastNMinutes,
            data[0].value.State.toLowerCase(),
            data[2].value,
            data[0].value.WorkflowRepository.objectName,
            data[0].value.ProcessorPools.map((mbean) => mbean.objectName)            
        );
    }

    private parseChartCountResponse = (response): StatesPrint => {
        console.log('chart responce', response.data);
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

    private parseBrokenWorkflowsResponse = (response): WorkflowInfo[] => {
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
        return !subResponse.error && (subResponse.value !== null ||  subResponse.value !== undefined);
    }
}
