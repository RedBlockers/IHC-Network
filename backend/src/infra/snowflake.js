"use strict";

const EPOCH = 1_704_067_200_000n;

const NODE_BITS = 10n;
const SEQUENCE_BITS = 12n;

const MAX_NODE = (1n << NODE_BITS) - 1n;
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n;

const TIMESTAMP_SHIFT = NODE_BITS + SEQUENCE_BITS;
const NODE_SHIFT = SEQUENCE_BITS;

class SnowflakeGenerator {
    constructor(nodeId) {
        const node = BigInt(nodeId);
        if (node < 0n || node > MAX_NODE) {
            throw new RangeError(`nodeId hors plage 0-${MAX_NODE} : ${nodeId}`);
        }
        this.node = node;
        this.lastTimestamp = -1n;
        this.sequence = 0n;
    }

    next() {
        let now = BigInt(Date.now());

        if (now < this.lastTimestamp) now = this._waitUntil(this.lastTimestamp);

        if (now === this.lastTimestamp) {
            this.sequence = (this.sequence + 1n) & MAX_SEQUENCE;
            if (this.sequence === 0n) now = this._waitUntil(this.lastTimestamp + 1n);
        } else {
            this.sequence = 0n;
        }

        this.lastTimestamp = now;

        const id = ((now - EPOCH) << TIMESTAMP_SHIFT) | (this.node << NODE_SHIFT) | this.sequence;
        return id.toString();
    }

    _waitUntil(target) {
        let now = BigInt(Date.now());
        while (now < target) now = BigInt(Date.now());
        return now;
    }
}

function timestampOf(id) {
    return Number((BigInt(id) >> TIMESTAMP_SHIFT) + EPOCH);
}

function idAtTime(date) {
    const millis = BigInt(Math.max(Number(date), 0));
    if (millis <= EPOCH) return "0";
    return String((millis - EPOCH) << TIMESTAMP_SHIFT);
}

const config = require("../config");
const generator = new SnowflakeGenerator(config.NODE_ID);

module.exports = { generator, SnowflakeGenerator, timestampOf, idAtTime, EPOCH };
