import { Component, Vue, Watch } from 'vue-property-decorator';
import { setTimeout } from 'timers';
import { WorkflowInfo, EngineStatus } from '../../../models/engine';
import { Notification } from '../../../models/notification';
import { JmxService } from '../../../services/jmxService';

import './workflows.scss';
import { ConnectionSettings } from '../../../models/connectionSettings';

export class WorkflowContext {
    public open: boolean = false;
    public reloading: boolean = false;
}

@Component({
    template: require('./workflows.html'),
    services: ['jmxService', 'eventHub'],
    components: {
    }
})
export class WorkflowsComponent extends Vue {
    workflowsContext: Map<String, WorkflowContext> = new Map<String, WorkflowContext>(); 
    workflows: WorkflowInfo[] = [];
    fetchBrokenWFInterval: any;
    page: number = 1;
    perPage: number = 10;
    perPageItems: number[] = [10, 15, 25, 50];

    private jmxService: JmxService = this.$services.jmxService;
    private eventHub: Vue = this.$services.eventHub;


    get status() {
        return this.$store.state.engineStatus;
    }

    mounted() {
        this.sheduleFetchingBrrokenWF();
        if (this.$store.state.engineStatus) {
            // this.totalPages =;

            console.log('this.totalPages', this.totalPages);
        }
    }

    get totalPages() {
        if (this.$store.state.engineStatus) {
             let total = Math.ceil((this.$store.state.engineStatus as EngineStatus).brokenWFCount / this.perPage);

             if (this.page > total) {
                 this.page = 1; 
             }

             return total;
        }
        this.page = 1;
        return 1;
    }

    created() {
        console.log('WorkflowsComponent is created');
    }

    beforeDestroy() {
        clearInterval(this.fetchBrokenWFInterval);
    }

    @Watch('$store.state.connectionSettings')
    sheduleFetchingBrrokenWF() {
        console.log('sheduleFetchingBrrokenWF');
        if (this.fetchBrokenWFInterval) {
            clearInterval(this.fetchBrokenWFInterval);
        }
        this.getBrokenWorkflows(this.$store.state.connectionSettings);
        this.fetchBrokenWFInterval = setInterval(() => {
            this.getBrokenWorkflows(this.$store.state.connectionSettings);
        }, this.$store.state.connectionSettings.updatePeriod * 1000);
    }

    private getBrokenWorkflows(connectionSettings: ConnectionSettings) {
        this.jmxService.getBrokenWorkflows(connectionSettings, this.perPage, (this.page - 1) * this.perPage).then((response: WorkflowInfo[]) => {
            this.workflows = response;
        });
    }

    restartAll() {
        this.jmxService.restartAll(this.$store.state.connectionSettings)
            .then((done) => {
                this.forceStatusFetch(500);
                if (done) {
                    this.showSuccess('All workflows restarted successfully');
                } else {
                    this.showError('Failed to restart all workflows');
                }
            }).catch((err) => {
                // TODO show toast
                this.showError('Failed to restart all workflows due to:' + err);
                console.error('Failed to restart workflows due to:', err);
            });
    }

    deleteAll() {
        this.jmxService.deleteAll(this.$store.state.connectionSettings, this.workflows)
        .then((done) => {
            if (done) {
                this.showSuccess('All workflows deleted successfully');
            } else {
                this.showError('Failed to Delete all workflows');
            }
            this.forceStatusFetch();
        }).catch((err) => {
            this.showError('Failed to Delete all workflows due to: ' + err);
            console.error('Failed to Delete all workflows due to:', err);
        });
    }

    restart(id: string) {
        console.log('Will restart WF with Id ' + id);
        this.jmxService.restart(this.$store.state.connectionSettings, id)
        .then((done) => {
            if (done) {
                let wfContext = this.workflowsContext.get(id);
                if (!wfContext) {
                    wfContext = new WorkflowContext();
                }
                wfContext.reloading = true; 
                this.workflowsContext.set(id, wfContext);
                this.$forceUpdate();
                setTimeout(() => { 
                    wfContext.reloading = false; 
                    this.workflowsContext.set(id, wfContext);
                    this.$forceUpdate();
                }, 800);
                
                this.forceStatusFetch(500);
                this.showSuccess(`Workflow id: ${id} restarted successfully`);
            } else {
                this.showError(`Failed to restart workflow id: ${id}`);
            }
            
        }).catch((err) => {
            this.showError(`Failed to restart workflow id: ${id} due to: ${err}`);
            console.error(`Failed to restart workflow id: ${id} due to: ${err}`);
        });
    }

    deleteBroken(id: string) {
        console.log('Will delete Broken WF with Id ' + id);
        this.jmxService.deleteBroken(this.$store.state.connectionSettings, id)
        .then((done) => {
            // this.forceStatusFetch();
            this.workflows = this.workflows.filter((workflow) => workflow.id !== id);
            if (done) {
                this.showSuccess(`Workflow id: ${id} deleted successfully`);
            } else {
                this.showError(`Failed to delete workflow id: ${id}`);
            }
        }).catch((err) => {
            // TODO show toast
            this.showError(`Failed to delete workflow id: ${id} due to: ${err}`);
        });
    }

    showDetails(workflow: WorkflowInfo) {
        let wfContext = this.workflowsContext.get(workflow.id);
        if (!wfContext) {
            wfContext = new WorkflowContext();
        }
        wfContext.open = !wfContext.open; 
        this.workflowsContext.set(workflow.id, wfContext);
        this.$forceUpdate();
    }

    private showSuccess(message: String) {
        this.eventHub.$emit('showNotification', new Notification(message));
    }

    private showError(message: String) {
        this.eventHub.$emit('showNotification', new Notification(message, 'error'));
    }

    @Watch('page')
    @Watch('perPage')
    private forceStatusFetch(delay: number = 0) {
        setTimeout(() => {
            this.getBrokenWorkflows(this.$store.state.connectionSettings);
        }, delay);
    }
}