import "dotenv/config";
import { InstallGlobalCommands } from "./utils.js";

const START_REACTOR = {
  name: "start_reactor",
  description: "To start the reactor service.",
  type: 1,
};

const STOP_REACTOR = {
  name: "stop_reactor",
  description: "To stop the reactor service.",
  type: 1,
};

const START_SERVICE = {
  name: "start_service",
  description: "Start the schedule delete service",
  type: 1,
};

const STOP_SERVICE = {
  name: "stop_service",
  description: "Stop the schedule delete service",
  type: 1,
};

const CHECK_SERVICE = {
  name: "check_service",
  description: "Check the status of the service",
  type: 1,
};

const ALL_COMMANDS = [
  START_REACTOR,
  STOP_REACTOR,
  START_SERVICE,
  STOP_SERVICE,
  CHECK_SERVICE,
];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
