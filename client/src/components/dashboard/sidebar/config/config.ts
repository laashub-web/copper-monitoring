import { Component, Vue, Prop } from 'vue-property-decorator';
import { Notification } from '../../../../models/notification';
import { ConnectionSettings } from '../../../../models/connectionSettings';
import './config.scss';
import { setTimeout } from 'timers';

@Component({
    template: require('./config.html')
})
export class ConfigComponent extends Vue {
    @Prop() connectionSettings: ConnectionSettings;
    @Prop() type: string;

    host: string = '';
    port: string = '1099';
    username: string = '';
    password: string = '';
    valid = true;
    dialogDeleteOpen: boolean = false;
    showPass: boolean = false;
    savePass: boolean = false;

    // Form Validation Rules
    hostRules = [ (v) => !!v || 'Host is required' ];
    portRules = [ (v) => !!v || 'Port is required' ];
    numberRules = [ (v) => /^\d+$/.test(v) || 'Should be number' ];
    
    mounted() {
        this.host = this.connectionSettings.host;
        this.port = this.connectionSettings.port;
        this.username = this.connectionSettings.username;
        this.password = this.connectionSettings.password;
        this.savePass = this.connectionSettings.passwordSaved;
    }

    private deleteSettings() {
        this.dialogDeleteOpen = false;
        this.$emit('deleteSettings');
    }

    submit() {
        let newConnection = new ConnectionSettings(this.host, this.port, this.username, this.password);
        if (this.connectionExists(newConnection)) {
            this.$services.eventHub.$emit('showNotification', new Notification('Connection is a duplicate', 'red'));
        } else {
            let lsConnectionKey = this.$store.state.user.name + '_' + newConnection.toString();            
            if (this.savePass === true) {
                localStorage.setItem(lsConnectionKey, JSON.stringify(newConnection)); 
            } else {
                localStorage.removeItem(lsConnectionKey);
            }
            this.$emit('updateTarget', newConnection);  
        }
    }

    connectionExists(newConnection: ConnectionSettings) {
        if ((this.type !== 'createNew') && (newConnection.host === this.connectionSettings.host) && (newConnection.port === this.connectionSettings.port)) {
            return false;
        }

        return this.$store.state.connectionSettings.find(currentConnections => (newConnection.host === currentConnections.host) && (newConnection.port === currentConnections.port));
    }

}