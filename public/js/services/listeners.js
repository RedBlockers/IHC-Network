import {MessageRenderer} from '../components/messageRenderer.js'
import {scrollToBottom} from '../utils/scrollUtils.js'
import {displayChannel} from "../components/channelRenderer.js";

export class Listeners {
    constructor() {
        this.socket = io()
    }
    listenForMessages(){
        const match = window.location.href.match('\\/(\\d+)\\/(\\d+)$')
        const channel = match[2];
        this.socket.on(`newMessage/${channel}`, (message) => {
            MessageRenderer.displayMessage(message);
            scrollToBottom();
        });
    }
    listenForChannels(){
        const match = window.location.href.match('\\/(\\d+)\\/(\\d+)$')
        const guild = match[1];
        this.socket.on(`newChannel/${guild}`, (channel) => {
            displayChannel(channel);
        })
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