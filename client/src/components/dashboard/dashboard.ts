import { Component, Vue, Watch, Prop } from 'vue-property-decorator';
import { ConnectionSettings, ConnectionResult } from '../../models/connectionSettings';
import { JmxService } from '../../services/jmxService';
import * as utils from '../../util/utils';
import './dashboard.scss';
import { EngineStatus } from '../../models/engine';
import { User } from '../../models/user';
import { MBeans, MBean } from '../../models/mbeans';
import * as _ from 'lodash';
import { Mutations } from '../../store.vuex';
import VuePerfectScrollbar from 'vue-perfect-scrollbar';

const sidebarComponent = () => import('./sidebar').then(({ SidebarComponent }) => SidebarComponent);

@Component({
    template: require('./dashboard.html'),
    services: ['jmxService', 'eventHub'],
    components: {
        'sidebar': sidebarComponent,
        'scroll': VuePerfectScrollbar
    }
})
export class DashboardComponent extends Vue {
    interval: any;
    menuOpen: boolean = false;
    update: number;
    fetch: number;
    themeSwitch: boolean = true;
    dialogConfigOpen: boolean = false;
    configText: string = '';
    queryText: string = '';
    
    get user() {
        return this.$store.state.user;
    }
    get connectionSettings() {
        return this.$store.state.connectionSettings;
    }

    created() {
        this.getTheme();
        this.getPeriodSettings();
        this.menuOpen = false;
        (this.$services.eventHub as Vue).$on('forceStatusFetch', this.forceFetchingStatus);
    }

    mounted() {  
        this.parseRoute();
        this.sheduleFetchingStatus();
    }
        
    beforeDestroy() {
        clearInterval(this.interval);
        (this.$services.eventHub as Vue).$off('forceStatusFetch', this.forceFetchingStatus);
    }

    getTheme() {
        this.themeSwitch = this.$store.state.user.settings.darkTheme;
    }

    getPeriodSettings() {
        this.fetch = this.$store.state.user.settings.fetchPeriod;
        this.update = this.$store.state.user.settings.updatePeriod;
    }

    setFetch() {
        localStorage.setItem(this.$store.state.user.name + ':fetchPeriod', String(this.fetch));
        this.$store.state.user.settings.fetchPeriod = this.fetch;
    }

    setUpdate() {
        localStorage.setItem(this.$store.state.user.name + ':updatePeriod', String(this.update));
        this.$store.state.user.settings.updatePeriod = this.update;
    }

    forceInt(data: any) {
        if (typeof data === 'number') {
            return data;
        } else {
            return parseInt(data);
        }
    }

    // @Watch('$route')
    parseRoute() {
        if (this.$route.fullPath.split('?').length > 1 ) {
            let params = this.$route.fullPath.split('?');
            if (params && params[1]) {
                params = decodeURI(params[1]).split('&');
                if (params) {
                    let settings: ConnectionSettings[] = [];
                    params.forEach(connection => {
                        let parsed = connection.split('=');

                        if (parsed && parsed[0] === 'connection') {
                            parsed = parsed[1].split('|');
                            
                            if (parsed[0] && parsed[1]) {
                                settings.push(new ConnectionSettings(parsed[0], parsed[1]));
                            }
                        }
                    });

                    if (settings.length > 0) {
                        // this.$store.commit(Mutations.setConnectionSettings, settings);
                        this.$store.commit(Mutations.setConnectionSettings, settings);
                    }
                }
            }
        }
    }

    logout() {
        this.$store.commit(Mutations.setUser, null);
        this.$router.replace('/login'); 
    }

    dialogConfig() {
        this.generateConfigFile();
        this.dialogConfigOpen = true;
    }

    generateConfigFile() {
        this.configText = '[[inputs.jolokia2_proxy]]\n#url goes from process.env.API_NAME variable like in jmxService. credentials is current user\n' +
            '     url = "' + process.env.API_NAME + '"\n' +
            '     username = "' + this.$store.state.user.name + '"\n' +
            '     password = "' + this.$store.state.user.password + '"\n\n' +
            '#From connections\n';
       
        this.$store.state.connectionResults.map((connection) => {
            this.configText += '[[inputs.jolokia2_proxy.target]]\n' +
                '     url = "service:jmx:rmi:///jndi/rmi://' + connection.settings.host + ':' + connection.settings.port + '/jmxrmi"\n';
        });

        this.configText += '\n#From engines. Name made from connection name and engine name to prevent collisions\n';    
        this.$store.state.engineStatusList.map((engine) => {
            let bean = this.$store.getters.engineMBeans[engine.id];
            let name = this.parseBeanName(bean.name);
            this.configText += '[[inputs.jolokia2_proxy.metric]]\n' +
                '     name = "' + bean.connectionSettings.host + '_' + bean.connectionSettings.port + '_' + name + '"\n' +
                '     mbean = "' + bean.name + '"\n' +
                '     paths = [ "InvalidCount", "ErrorCount", "WaitingCount", "RunningCount", "FinishedCount", "DequeuedCount" ]\n\n';
        });
        this.queryText = '#Basic SELECT Query\n' +
            'SELECT <field_key>[,<field_key>,<tag_key>] FROM <measurement_name>[,<measurement_name>]\n\n' +  
            'SELECT <field_key>[,<field_key>,<tag_key>] FROM <measurement_name>[,<measurement_name>]\n\n' +  
            'SELECT <field_key>[,<field_key>,<tag_key>] FROM <measurement_name>[,<measurement_name>]\n\n' +
            'SELECT <field_key>[,<field_key>,<tag_key>] FROM <measurement_name>[,<measurement_name>]\n\n' +          
            'SELECT <field_key>[,<field_key>,<tag_key>] FROM <measurement_name>[,<measurement_name>]\n\n' +  
            'SELECT <field_key>[,<field_key>,<tag_key>] FROM <measurement_name>[,<measurement_name>]\n\n' +  
            'SELECT <field_key>[,<field_key>,<tag_key>] FROM <measurement_name>[,<measurement_name>]\n\n' +
            'SELECT <field_key>[,<field_key>,<tag_key>] FROM <measurement_name>[,<measurement_name>]\n\n' +
            'SELECT <field_key>[,<field_key>,<tag_key>] FROM <measurement_name>[,<measurement_name>]\n\n' +
            'SELECT <field_key>[,<field_key>,<tag_key>] FROM <measurement_name>[,<measurement_name>]\n\n' +            
            'SELECT <field_key>[,<field_key>,<tag_key>] FROM <measurement_name>[,<measurement_name>]\n\n';
    }

    parseBeanName(fullName: string) {
        return fullName.substr(19);
    }

    downloadConfig() {
        let blob = new Blob([this.configText], {type: 'text/csv'});
        if (window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveBlob(blob, 'telegraf.conf');
        }
        else {
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
    }

    @Watch('themeSwitch')
    toggleTheme() {
        localStorage.setItem('darkTheme', String(this.themeSwitch));
        localStorage.setItem(this.$store.state.user.name + ':darkTheme', String(this.themeSwitch));
        this.$store.commit(Mutations.updateTheme, this.themeSwitch);
    }

    @Watch('$store.state.connectionSettings')
    sheduleFetchingStatus() {
        if (this.$store.state.connectionSettings.length === 0) {
            if (this.interval) {
                clearInterval(this.interval);
            }
            this.$store.commit(Mutations.updateEngineStatus, []);
            this.$store.commit(Mutations.updateConnectionResults, []);

            return;
        }

        (this.$services.jmxService as JmxService)
                .getConnectionResults(this.$store.state.connectionSettings, this.$store.state.user)
                .then((results: ConnectionResult[]) => {
            let notConnected: ConnectionResult;
            if (results) {
                if (this.$store.state.appCriticalError) {
                    this.$store.commit(Mutations.setAppCriticalError, null);
                }
                this.$store.commit(Mutations.updateConnectionResults, results);
                
                if (this.interval) {
                    clearInterval(this.interval);
                }
                
                if (this.$store.getters.engineMBeans && this.$store.getters.engineMBeans.length > 0) {
                    this.getEngineStatus(this.$store.getters.engineMBeans, this.$store.state.user);
                    this.interval = setInterval(() => {
                        this.getEngineStatus(this.$store.getters.engineMBeans, this.$store.state.user);
                    }, this.$store.getters.updatePeriod * 1000);
                }  else {
                    this.$store.commit(Mutations.updateEngineStatus, []);
                }
                
                notConnected = results.find((conResult: ConnectionResult) => {
                    return !conResult.mbeans || conResult.mbeans.length === 0;
                });
            }
                
            if (!results || notConnected) {
                if (!results) {
                    console.error('Received no connection results in response. Perhaps issue with connection to server with Jolokia.\n Will schuedule refetching MBeans in three seccond');
                    this.$store.commit(Mutations.setAppCriticalError, 'Received no connection results in response. Perhaps issue with connection to server with Jolokia.');
                }

                if (notConnected) {
                    console.error(`Received no connection to ${notConnected.settings.host}:${notConnected.settings.port}. Will schuedule refetching MBeans in three seccond`);
                }

                setTimeout(() => {
                    this.sheduleFetchingStatus();
                }, 3000);
            }
        });
    }

    forceFetchingStatus(delay: number = 0) {
        setTimeout(() => {
            this.getEngineStatus(this.$store.getters.engineMBeans, this.$store.state.user);
        }, delay);
    }

    private getEngineStatus(mbeans: MBean[], user: User) {
        (this.$services.jmxService as JmxService).getEngineStatus(mbeans, user).then((engineStatusList: EngineStatus[]) => {
            if (!engineStatusList) {
                engineStatusList = [];
                if (this.interval) {
                    clearInterval(this.interval);
                }

                this.sheduleFetchingStatus();
            }

            this.$store.commit(Mutations.updateEngineStatus, engineStatusList);
        });
    }
}