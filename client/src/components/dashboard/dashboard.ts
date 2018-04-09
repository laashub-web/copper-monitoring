import { Component, Vue, Watch, Prop } from 'vue-property-decorator';
import { ConnectionSettings, ConnectionResult } from '../../models/connectionSettings';
import { JmxService } from '../../services/jmxService';
import * as utils from '../../util/utils';
import './dashboard.scss';
import { EngineStatus } from '../../models/engine';
import { User } from '../../models/user';
import { MBeans, MBean } from '../../models/mbeans';
import * as _ from 'lodash';

const sidebarComponent = () => import('./sidebar').then(({ SidebarComponent }) => SidebarComponent);

@Component({
    template: require('./dashboard.html'),
    services: ['jmxService', 'eventHub'],
    components: {
        'sidebar': sidebarComponent,
    }
})
export class DashboardComponent extends Vue {
    updateStatusInterval: any;

    toggleTheme() {
        this.$store.commit('updateTheme', !this.$store.state.darkTheme);
    }
    
    get user() {
        return this.$store.state.user;
    }

    created() {  
        (this.$services.eventHub as Vue).$on('forceStatusFetch', this.forceFetchingStatus);
    }
        
    beforeDestroy() {
        clearInterval(this.updateStatusInterval);
        (this.$services.eventHub as Vue).$off('forceStatusFetch', this.forceFetchingStatus);
    }

    mounted() {

        this.parseRoute();
        this.sheduleFetchingStatus();
    }

    logout() {
        this.$store.commit('setUser', null);
        this.$router.replace('/login'); 
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
                        this.$store.commit('setConnectionSettings', settings);
                    }
                }
            }
        }
    }

    @Watch('$store.state.connectionSettings')
    sheduleFetchingStatus() {
        if (this.$store.state.connectionSettings.length === 0) {
            if (this.updateStatusInterval) {
                clearInterval(this.updateStatusInterval);
            }
            this.$store.commit('updateMBeans', new MBeans([]));
            this.$store.commit('updateEngineStatus', []);
            this.$store.commit('updateConnectionResults', []);
            return;
        }

        (this.$services.jmxService as JmxService)
        .getConnectionResults(this.$store.state.connectionSettings, this.$store.state.user)
        .then((results: ConnectionResult[]) => {
            console.log('getConnectionResults', results);
            this.$store.commit('updateConnectionResults', results);

            if (this.updateStatusInterval) {
                clearInterval(this.updateStatusInterval);
            }

            let mbeans: MBean[] = _.flatMap(results.map(result => result.mbeans ));
            if (mbeans && mbeans.length > 0) {
                this.$store.commit('updateMBeans', new MBeans(mbeans));
                this.getEngineStatus(mbeans, this.$store.state.user);
                this.updateStatusInterval = setInterval(() => {

                    this.getEngineStatus(mbeans, this.$store.state.user);
                }, this.$store.state.connectionSettings[0].updatePeriod * 1000);
            } else {
                this.$store.commit('updateMBeans', new MBeans([]));
                this.$store.commit('updateEngineStatus', []);
                // this.getMBeans(this.$store.state.connectionSettings, this.$store.state.user);
                // this.updateStatusInterval = setInterval(() => {
                //     this.getMBeans(this.$store.state.connectionSettings, this.$store.state.user);
                // }, this.$store.state.connectionSettings.updatePeriod * 1000);
            }
        });
    }

    forceFetchingStatus(delay: number = 0) {
        setTimeout(() => {
            this.getEngineStatus(this.$store.state.mbeans, this.$store.state.user);
        }, delay);
    }


    private getEngineStatus(mbeans: MBean[], user: User) {
        (this.$services.jmxService as JmxService).getEngineStatus(mbeans, user).then((enginStatusList: EngineStatus[]) => {
            if (!enginStatusList) {
                enginStatusList = [];
            }

            this.$store.commit('updateEngineStatus', enginStatusList);
        });
    }

    // private getMBeans(connectionSettings: ConnectionSettings, user: User) {
    //     (this.$services.jmxService as JmxService).getMBeans(this.$store.state.connectionSettings, this.$store.state.user).then((mbeans: MBean[]) => {
    //         if (mbeans && mbeans.length > 0) {
    //             this.$store.commit('updateMBeans', new MBeans(mbeans));
    //         } else {
    //             this.$store.commit('updateMBeans', new MBeans([]));
    //         }
    //    });
    // }
}