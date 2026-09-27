const core = require('./repo.core.controller');
const git = require('./repo.git.controller');
const cli = require('./repo.cli.controller');

module.exports = {
    ...core,
    ...git,
    ...cli,
};