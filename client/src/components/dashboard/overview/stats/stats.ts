import { Component, Vue, Prop } from 'vue-property-decorator';
import { StatesPrint, ChartStates, EngineGroup, EngineStatus } from '../../../../models/engine';
import { VueCharts, Bar, Line, mixins } from 'vue-chartjs';
import { StatisticsService } from '../../../../services/statisticsService';
import { EngineStatData } from '../index';

@Component({
    template: require('./stats.html'),
    services: ['statisticsService', 'eventHub'],
    components: {
        'line-chart': {
            extends: Line,
            mixins: [mixins.reactiveProp],
            props: ['chartData', 'options'],
            mounted () {
              this.renderChart(this.chartData, this.options);
            }
        }
    }
})

export class Stats extends Vue {
    @Prop() dataset: EngineStatData;
    private eventHub: Vue = this.$services.eventHub;
    chartData = null;
    states = new ChartStates(true, true, true, true, true, true);
    chartOptions = {
        animation: {
            duration: 0, // general animation time
            // easing: 'easeInCirc'
        },
        elements: {
            line: {
                tension: 0, // disables bezier curves
            }
        }
    };

    created() {
        this.eventHub.$on('updateChartData', this.update);
    }

    mounted() {
        this.update();
    }

    update() {
        this.chartData = this.getChartData(this.states, this.dataset.data);
    }

    getChartData(states: ChartStates, statesPrint: StatesPrint[]) {
        let dataset = [];
        if (statesPrint) {
            if (states.running) {
                dataset.push({
                    label: 'RUNNING',
                    backgroundColor: '#41ce00c4', // green
                    data: statesPrint.map((state) => state ? state.running : 0)
                });
            }
            if (states.waiting) {
                dataset.push({
                    label: 'WAITING',
                    backgroundColor: '#e4c200de', // yellow
                    data: statesPrint.map((state) => state ? state.waiting : 0)
                });
            }
            if (states.finished) {
                dataset.push({
                    label: 'FINISHED',
                    backgroundColor: '#1ad8b9c4',  // grey
                    data: statesPrint.map((state) => state ? state.finished : 0)
                });
            }
            if (states.dequeued) {
                dataset.push({
                    label: 'DEQUEUED',
                    backgroundColor: '#0b7babc4',  // blue
                    data: statesPrint.map((state) => state ? state.dequeued : 0)
                });
            }
            if (states.error) {
                dataset.push({
                    label: 'ERROR',
                    backgroundColor: '#de1515c4',  // red
                    data: statesPrint.map((state) => state ? state.error : 0)
                });
            }
            if (states.invalid) {
                dataset.push({
                    label: 'INVALID',
                    backgroundColor: '#770202c4',  // dark red
                    data: statesPrint.map((state) => state ? state.invalid : 0)
                });
            }
        }

        return {
            labels: statesPrint ? statesPrint.map((state) => state ? (Vue as any).moment(state.time).format('HH:mm:ss') : 'NA') : [],
            datasets: dataset
        };
  }
}