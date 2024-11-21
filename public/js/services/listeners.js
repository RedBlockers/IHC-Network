import {MessageRenderer} from '../components/messageRenderer.js'
import {scrollToBottom} from '../utils/scrollUtils.js'

export class Listeners {
    constructor() {
        this.socket = io()
    }
    listenForMessages(){
        this.socket.on('newMessage', (message) => {
            console.log(message)
            MessageRenderer.displayMessage(message);
            scrollToBottom();
        });
    }
    listenForAll(){
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
            .filter(prop => typeof this[prop] === 'function');
        methods.forEach(method => {
            if (!['listenForAll','constructor'].includes(method)) {
                this[method]()
            }
        })
    }
}