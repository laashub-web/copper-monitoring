import { Component, Vue, Watch } from 'vue-property-decorator';
import { StatesPrint, ChartStates, EngineGroup, EngineStatus } from '../../../models/engine';
import VuePerfectScrollbar from 'vue-perfect-scrollbar';
import { Notification } from '../../../models/notification';
import { InfluxDBService } from '../../../services/influxDBService';
import { StatisticsService } from '../../../services/statisticsService';
import { setTimeout } from 'timers';
import * as _ from 'lodash';
import './overview.scss';

const Stats = () => import('./stats').then(({ Stats }) => Stats);

export class BeanContext {
    constructor(
        public beanName: string,
        public engineName: string
    ) {}
}

export class BeanConflict {
    public beanName: string;
    public conflictEngines: string[];
}

export class TimeSelection {
    constructor(public label: string, public time: number) {}
}

export class EngineStatData {
    constructor(public name: string, public data: any[]) {}
}

@Component({
    template: require('./overview.html'),
    services: ['influxService', 'eventHub', 'statisticsService'],
    components: {
        'scroll': VuePerfectScrollbar,
        'stats': Stats
    }
})
export class Overview extends Vue {
    private eventHub: Vue = this.$services.eventHub;
    private statisticsService: StatisticsService = this.$services.statisticsService;
    private influx: InfluxDBService = this.$services.influxService;
    groups: EngineGroup[] = [];
    timeSelect: TimeSelection[];
    currentTimeSelection: TimeSelection = null;
    layoutSelect: string[]= ['Row', 'Column'];
    currentLayout: string = 'Row';
    openOptions: boolean = false;
    fetchInterval: any;
    openInfluxDialog: boolean = false;
    connectionSuccess: boolean = false;
    url: string = '';
    username: string = '';
    password: string = '';
    configText: string = '';
    queryText: string = '';
    beanCollisions: BeanConflict[] = [];
    clickAllowed: boolean = true;
    openTelegrafInput: boolean = false;
    openSampleQueries: boolean = false;
    statMap = null;
    statData: EngineStatData[] = [];
    states = new ChartStates(true, true, true, true, true, true);

    created() {
        this.timeSelect = this.statisticsService.intervals
            .map((interval) => new TimeSelection(this.createLabel(interval), interval));
        this.currentTimeSelection = this.timeSelect[3];
    }

    createLabel(interval: number) {
        if ((interval / 60) >= 1) {
            return ((interval / 60) + ' min');
        } else {
            return ((interval) + ' sec');
        }
    }

    mounted() {
        this.getInfluxConnection();

        this.getDataFromInflux();
        // this.getData();
    }

    getDataFromInflux() {
        this.groups = this.$store.getters.groupsOfEngines;
        let names = [];
        this.groups.forEach( group => {
            names = names.concat(group.engines.map( engine => engine.engineId + '@' + this.getConnectionName(engine.id)));
        });
        // this.influx.testInfluxDB();

        this.influx.getData(this.currentTimeSelection.time, names).then( result => {
            console.log('overview result', result);
        });
    }
    
    getDataFlomLocal() {
        this.groups = this.$store.getters.groupsOfEngines;
        this.eventHub.$emit('updateStats');
    }

    beforeDestroy() {
        this.statisticsService.stop();
        clearInterval(this.fetchInterval);
    }

    get getRow() {
        if (this.currentLayout === 'Row') {
            return true;
        }
        else {
            return false;
        }
    }

    getInfluxConnection() {
        if (this.$store.state.user.influx.username !== null && this.$store.state.user.influx.username !== undefined && this.$store.state.user.influx.username !== '')  {
            this.username = this.$store.state.user.influx.username;
        }
        if (this.$store.state.user.influx.password !== null && this.$store.state.user.influx.password !== undefined && this.$store.state.user.influx.password !== '') {
            this.password = this.$store.state.user.influx.password;
        }
        if (this.$store.state.user.influx.url !== null && this.$store.state.user.influx.url !== undefined && this.$store.state.user.influx.url !== '') {
            this.url = this.$store.state.user.influx.url;
            this.username = this.$store.state.user.influx.username;
            this.password = this.$store.state.user.influx.password;
            this.testConnection();
        }
    }

    storeInfluxConnection() {
        localStorage.setItem('influxURL', this.url);
        localStorage.setItem('influxUser', this.username);
        localStorage.setItem('influxPass', this.password);
        this.$store.state.user.influx.url = this.url;
        this.$store.state.user.influx.username = this.username;
        this.$store.state.user.influx.password = this.password;
    }

    getData() {
        this.groups = this.$store.getters.groupsOfEngines;
        this.statMap =  this.statisticsService.getData(this.currentTimeSelection.time, this.getNames());
        this.statData = [];
        this.statMap.forEach((value, key) => {
            this.statData.push(new EngineStatData(key, value));
        });
        this.eventHub.$emit('updateChartData');
    }

    getNames() {
        let nameArray = this.groups.map((group) => {
            if (group.engines.length > 1) {
                return group.name;
            } else {
                return group.engines[0].engineId + '@' + this.getConnectionName(group.engines[0].id);
            }
        });
        return nameArray;
    }

    getConnectionName(id: number) {
        let connection = this.$store.getters.engineMBeans[id].connectionSettings;
        return connection.host + ':' + connection.port;
    }

    updateFetch(selection: TimeSelection) {
        this.currentTimeSelection =  selection;
        this.scheduleFetch();
    }

    getName(group: EngineGroup) {
        if (group.engines.length > 1) {
            return group.name;
        } else {
            return group.engines[0].engineId;
        }
    }

    triggerOpenInflux() {
        this.generateConfigFile();
        this.generateSampleQueries();
        this.openInfluxDialog = true;
    }

    generateConfigFile() {

        let beanNames = [];

        this.configText = '[[inputs.jolokia2_proxy]]\n#url goes from process.env.API_NAME variable like in jmxService. credentials is current user\n' +
            '     url = "' + this.parseURL() + '"\n' +
            '     username = "' + this.$store.state.user.name + '"\n' +
            '     password = "' + this.$store.state.user.password + '"\n\n' +
            '#From connections\n';

        this.$store.state.connectionResults.map((connection) => {
            this.configText += '[[inputs.jolokia2_proxy.target]]\n' +
                '     url = "service:jmx:rmi:///jndi/rmi://' + connection.settings.host + ':' + connection.settings.port + '/jmxrmi"\n';
        });

        this.configText += '\n#From engines. Name made from connection name and engine name to prevent collisions\n';
        this.$store.state.engineStatusList.map((engine, index) => {
            let bean = this.$store.getters.engineMBeans[engine.id];
            let name = this.parseBeanName(bean.name);
            // beanNames[index] = [bean.name, engine.engineId];
            beanNames[index] = new BeanContext(bean.name, engine.engineId);
            this.configText += '[[inputs.jolokia2_proxy.metric]]\n' +
                '     name = "' + engine.engineId + '@' + bean.connectionSettings.host + ':' + bean.connectionSettings.port + '"\n' +
                '     mbean = "' + bean.name + '"\n' +
                '     paths = [ "InvalidCount", "ErrorCount", "WaitingCount", "RunningCount", "FinishedCount", "DequeuedCount" ]\n\n';
        });
        this.checkBeanNameConflict(beanNames);
    }

    checkBeanNameConflict(beans) {
        let conflicts: BeanConflict[] = [];
        _.toPairs(_.groupBy(beans, 'beanName')).map((group) => {
            let conflict = new BeanConflict;
            conflict.beanName = group[0];
            conflict.conflictEngines = group[1].map((beanContext) => {
                return beanContext.engineName;
            });
            if (conflict.conflictEngines.length > 1) {
                conflicts.push(conflict);
            }
        });
        this.beanCollisions = conflicts;
    }

    generateSampleQueries() {
        this.queryText = '#Sample Queries\n\n';
        this.$store.getters.groupsOfEngines.map((group) => {

            let engine = group.engines[0];
            let bean = this.$store.getters.engineMBeans[engine.id];

            if (group.engines.length > 1) {
                this.queryText += '#Select Attributes for Group: ' + group.name + '@' + bean.connectionSettings.host + ':' + bean.connectionSettings.port + '\n';
            } else {
                this.queryText += '#Select Attributes for Engine: ' + engine.engineId + '@' + bean.connectionSettings.host + ':' + bean.connectionSettings.port + '\n';
            }

            this.queryText += 'SELECT' + '\nMAX("ErrorCount") AS "MAX_ErrorCount",' + '\nMAX("DequeuedCount") AS "MAX_DequeuedCount",' + '\nMAX("FinishedCount") AS "MAX_FinishedCount",' +
                '\nMAX("InvalidCount") AS "MAX_InvalidCount",' + '\nMAX("RunningCount") AS "MAX_RunningCount",' + '\nMAX("WaitingCount") AS "MAX_WaitingCount"' +
                '\nFROM "telegraf"."autogen"."' + engine.engineId + '@' + bean.connectionSettings.host + ':' + bean.connectionSettings.port + '"' +
                '\nWHERE time > now() - 1h GROUP BY time(10s) FILL(null)\n\n';
        });
    }

    parseURL() {
        if (process.env.API_NAME.substr(0, 4) !== 'http') {
            let subUrl = window.location.href.substr(7);
            let endIndex = subUrl.indexOf('/');
            return window.location.href.substr(0, (endIndex + 7)) + process.env.API_NAME;
        } else {
            return process.env.API_NAME;
        }
    }

    parseBeanName(fullName: string) {
        return fullName.substr(19);
    }

    downloadConfig() {
        let blob = new Blob([this.configText], {type: 'text/csv'});
        if (window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveBlob(blob, 'telegraf.conf');
        } else {
            let elem = window.document.createElement('a');
            elem.href = window.URL.createObjectURL(blob);
            elem.download = 'telegraf.conf';
            document.body.appendChild(elem);
            elem.click();
            document.body.removeChild(elem);
        }
    }

    copy(text) {
        let elem = window.document.createElement('textarea');
        elem.value = text;
        document.body.appendChild(elem);
        elem.select();
        document.execCommand('copy');
        document.body.removeChild(elem);
        this.eventHub.$emit('showNotification', new Notification('Copied to Clipboard'));
    }

    submit() {
        this.storeInfluxConnection();
        if (this.$store.state.user.influx.url !== null && this.$store.state.user.influx.url !== undefined && this.$store.state.user.influx.url !== '') {
            this.testConnection();
        }
    }

    testConnection() {
        this.influx.testConnection().then((response: any) => {
            if (this.parseInfluxResposne(response) === true) {
                this.connectionSuccess = true;
                this.storeInfluxConnection();
                this.eventHub.$emit('showNotification', new Notification('Connection Success'));
            } else {
                this.connectionSuccess = false;
                this.eventHub.$emit('showNotification', new Notification('Connection Failed', 'error'));
            }
        });
    }

    parseInfluxResposne(response) {
        let telegraf = false;
        if (response !== undefined && response !== null) {
            response[0].series[0].values.map((result) => {
                result.map((db) => {
                    if (db === 'telegraf') {
                        telegraf = true;
                    }
                });
            });
        }
        return telegraf;
    }

    triggerTelegrafInput() {
        if (this.clickAllowed === true) {
            this.clickAllowed = false;
            setTimeout(() => {
                this.clickAllowed = true;
            }, 750);
            if (this.openTelegrafInput === true) {
                this.scrollToTop(100);
            }
            this.openTelegrafInput = !this.openTelegrafInput;
        }
    }

    triggerSampleQueries() {
        if (this.clickAllowed === true) {
            this.clickAllowed = false;
            setTimeout(() => {
                this.clickAllowed = true;
            }, 750);
            if (this.openSampleQueries === true) {
                this.scrollToTop(150);
            }
            this.openSampleQueries = !this.openSampleQueries;
        }
    }

    // without this function, closing the Sample Queries section of the dialog
    // while scrolled down created strange behavior and styles. This function
    // smoothly scrolls up and resets the Scroll component when either Sample Queries
    // or Telegraf Input sections are closed to avoid this.
    scrollToTop(tick: number) {
        if (tick > 0) {
            setTimeout(() => {
                let elem = (this as any).$refs['perfectScroll'];
                elem.$el.scrollBy(0, -7);
                this.scrollToTop(tick - 1);
            }, 10);
        } else {
            (this as any).$refs.perfectScroll.update();
        }
    }

    scheduleFetch() {
        if (this.fetchInterval) {
            clearInterval(this.fetchInterval);
        }
        // this.getData();
        // this.fetchInterval = setInterval(() => {
        //     this.getData();
        // }, this.currentTimeSelection.time * 1000);
    }
}