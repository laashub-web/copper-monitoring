import { Vue } from 'vue-property-decorator';
import { ConnectionResult } from './connectionSettings';
import { MBean } from './mbeans';

export enum State {
    RAW,        // Workflow was just initialized, nothing happened with it so far
    ENQUEUED,   // Workflow is in queue and waits for execution (Used by transient engines) / waits for engine to take ownership and grep it from database (persistent)
    DEQUEUED,   // Workflow is pulled from database (dequeued) and put to the Processing pool queue. Dequeue is marked on the processing state within the database.
    RUNNING,    // Workflow is currently running (This state is set in RAM only. A persistent engine will not update the database whether a workflow is running (it keeps on dequeud)
    WAITING,    // Workflow is in wait state. The awake-conditions from wait are not yet (fully) fulfilled.
    FINISHED,   // Workflow finished execution normally.
    ERROR,      // Workflow stopped execution due to an exception. Might be resubmitted later on.
    INVALID     // Something illegal happened to the workflow. Cannot work with it anymore. In persistent mode, this might be caused by a deserialization error or something similar.
}

export class ChartStates {
    constructor(
        public running: boolean = true,
        public waiting: boolean = true,
        public finished: boolean = true,
        public dequeued: boolean = true,
        public error: boolean = true,
        public invalid: boolean = true
    ) {}
}

export class StatesPrint {
    constructor(
        public time: Date = new Date(),
        public running: number = undefined,
        public waiting: number = undefined,
        public finished: number = undefined,
        public dequeued: number = undefined,
        public error: number = undefined,
        public invalid: number = undefined,
        public engine: string = null) {}

    // toArray() {
    //     return [ (Vue as any).moment(this.time).format('HH:mm:ss'), this.running, this.waiting, this.finished, this.dequeued, this.error, this.invalid ];
    // }

    // equals(state: StatesPrint) {
    //     return this.waiting === state.waiting && this.running === state.running && this.finished === state.finished && this.dequeued === state.dequeued && this.error === state.error && this.invalid === state.invalid;
    // }
}

export class StatePromiseWrapper {
    constructor(public promise: Promise<void | Map<String, StatesPrint[]>>, public type: string) {}
}

export class EngineStatData {
    constructor(public name: string, public data: any[]) {}
}

export class EngineGroup {
    constructor(public name: string, public engines: EngineStatus[]) {}
}

export class EngineStatus {
    constructor(
        public id: number,
        public runningSince: Date,
        public lastProcessing: Date,
        public engineClusterId: string,
        public engineId: string,
        public type: string,
        public instances: number,
        public state: string,
        public brokenWFCount: number,
        public engineMXBean: MBean,
        public dbStorageMXBean: string,
        public wfRepoMXBean: string,
        public ppoolsMXBeans: string[]
    ) {}
}

export class ProcessorPool {
    constructor(
        public id: string = '',
        public state: string = '',
        public priority: number = 0,
        public queueSize: number = 0,
        public memoryQueueSize: number = 0 ,
        public dequeBulkSize: number = 0,
        public emptyQueueWait: number = 0,
        public upperThresholdWait: number = 0,        
        public upperThreshold: number = 0,
        public lowerThreshold: number = 0,
        public numThreads: number = 0,
        public numActiveThreads: number = 0,
        public mbean: string = ''
    ) {}
}

export class WorkflowFilter {
    constructor(
        public states: State[] = [State.ERROR, State.INVALID],
        public classname: string = null,
        public createFrom: number = null,
        public createTo: number = null,
        public modFrom: number = null,
        public modTo: number = null
    ) {}
}

export class WorkflowRepo {
    constructor(
        public description: string = '',
        public sourceDir: string = '',
        public lastBuildResults: string = null,
        public repoSize: number = 0,
        public workFlowInfo: Array<WorkflowClassInfo> = []
    ) {}
}

export class WorkflowContext {
    public open: boolean = false;
    public reloading: boolean = false;
    public deleting: boolean = false;
    public reloadButton: boolean = false;
    public deleteButton: boolean = false;
}

export class WorkflowInfo {
    public id: string;
    public state: string;
    public priority: number;
    public engineId: string;
    public processorPoolId: string;
    public timeout: Date;
    public workflowClassInfo: WorkflowClassInfo = new WorkflowClassInfo;
    public dataAsString: string;
    public lastWaitStackTrace: string;
    public errorData: ErrorData;
    public lastModTS: Date;
    public creationTS: Date;

    constructor() {}


    public getLastWaitingLineNum(): number {
        if (this.lastWaitStackTrace) {
            let className = '(' + this.getShortClassName() + '.java';
            let firstLine = this.lastWaitStackTrace.split('\n').find(line => line.indexOf(className) !== -1);
            if (firstLine) {
                let lineNum = parseInt(firstLine.substring(firstLine.lastIndexOf(':') + 1, firstLine.lastIndexOf(')')));
                return lineNum ? lineNum : -1;
            }
        }

        return -1;
    }
    public getErrorLineNum(): number {
        if (this.errorData && this.errorData.exceptionStackTrace) {
            let className = '(' + this.getShortClassName() + '.java';
            let firstLine = this.errorData && this.errorData.exceptionStackTrace.split('\n').find(line => line.indexOf(className) !== -1);
            if (firstLine) {
                let lineNum = parseInt(firstLine.substring(firstLine.lastIndexOf(':') + 1, firstLine.lastIndexOf(')')));
                return lineNum ? lineNum : -1;
            }
        }

        return -1;
    }

    public getShortClassName(): string {
        if (this.workflowClassInfo.classname) {
            let names = this.workflowClassInfo.classname.split('.');
            return names[names.length - 1];
        } else {
            return this.workflowClassInfo.classname;
        }
    }
}

export class WorkflowClassInfo {
    public sourceCodeLines: string[];

    constructor(
        public classname: string = '',
        public alias: string = '',
        public majorVersion: number = 0,
        public minorVersion: number = 0,
        public patchLevel: number = 0,
        public serialversionuid: number = 0,
        public sourceCode: string = '',
        public open: Boolean = false
    ) {}
}
export class ErrorData {
    constructor(
        public errorTS: Date,
        public exceptionStackTrace: string
    ) {}
}