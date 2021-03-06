// export type NotificationType =  'success' | 'error' | 'info';

export class Notification {
    public snackbar: boolean = true;
    constructor( 
        public text,
        public color: string = 'green',
        public timeout: number = 3000) {}
}