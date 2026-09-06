"use strict";

jest.mock("../src/db/pool", () => require("./helpers/db").mock);
jest.mock("../src/infra/redis", () => require("./helpers/redisMock"));
jest.mock("../src/realtime", () => require("./helpers/realtimeMock"));
jest.mock("../src/services/storageService", () => require("./helpers/storageMock"));

const { reset } = require("./helpers/db");
afterEach(() => reset());
