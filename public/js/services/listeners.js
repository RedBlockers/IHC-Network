import {MessageRenderer} from '../components/messageRenderer.js'
import {scrollToBottom} from '../utils/scrollUtils.js'

export class Listeners {
    constructor() {
        this.socket = io()
    }
    listenForMessages(){
        const match = window.location.href.match('\\/(\\d+)\\/(\\d+)$')
        const channel = match[2];
        this.socket.on(`newMessage/${channel}`, (message) => {
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