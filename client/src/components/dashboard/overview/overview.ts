import { Component, Vue, Watch } from 'vue-property-decorator';
import { EngineGroup } from '../../../models/engine';
import './overview.scss';

@Component({
    template: require('./overview.html'),
    services: ['jmxService', 'eventHub']
})
export class Overview extends Vue {
    groups: EngineGroup[] = [];
    timeSelect: string[] = ['5 sec', '15 sec', '30 sec', '1 min', '5 min', '15 min'];
    layoutSelect: string[]= ['Row', 'Column'];
    newTime: string = '1 min';
    newLayout: string = 'Row'; 
    openOptions: boolean = false;
    fetchPeriod: number;
    fetchInterval: any;

    mounted() {
        this.getEngines();
    }

    beforeDestroy() {
        clearInterval(this.fetchInterval);
    }

    get getRow() {
        if (this.newLayout === 'Row') {
            return true;
        }
        else {
            return false;
        }
    }

    updateTime(time: string) {
        this.newTime = time;
        this.fetchPeriod = this.getFetch();
        this.scheduleFetch();
    }

    getFetch() {
        let timeSplit = this.newTime.split(' ');
        let multiplier = 1;
        if (timeSplit[1] === 'min') {
            multiplier = 60;
        }
        return parseInt(timeSplit[0]) * multiplier;
    }

    getName(group: EngineGroup) {
        if (group.engines.length > 1) {
            return group.name;
        } else {
            return group.engines[0].engineId;
        }
    }

    scheduleFetch() {
        if (this.fetchInterval) {
            clearInterval(this.fetchInterval);
        }
        this.getEngines();
        this.fetchInterval = setInterval(() => {
            this.getEngines();
        }, this.fetchPeriod * 1000);
    }

    getEngines() {
        this.groups = this.$store.getters.groupsOfEngines;
    }
}