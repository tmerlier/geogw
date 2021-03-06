const sidekick = require('../helpers/sidekick');
const through2 = require('through2');
const mongoose = require('mongoose');
const { isNumber } = require('lodash');
const Promise = require('bluebird');

const RecordRevision = mongoose.model('RecordRevision');
const ConsolidatedRecord = mongoose.model('ConsolidatedRecord');
const Catalog = mongoose.model('Catalog');
const RemoteResource = mongoose.model('RemoteResource');


function processAllRecords(req, res) {
    let count = 0;
    RecordRevision.find().select('recordId recordHash').lean().stream()
        .pipe(through2.obj((recordRevision, enc, cb) => {
            return sidekick('process-record', recordRevision)
                .then(() => {
                    count++;
                    cb();
                })
                .catch(err => {
                    console.error(err);
                    cb(err);
                });
        }))
        .on('finish', () => {
            res.send({ task: 'process-all-records', status: 'ok', count });
        });
}

function consolidateRecords(req, res, next) {
  const reqLimit = parseInt(req.query.limit);
  const limit = isNumber(reqLimit) && reqLimit > 0 ? reqLimit : 100;

  ConsolidatedRecord.consolidateMany({ limit })
    .then(({ count }) => res.status(202).send({ task: 'consolidate-records', count }))
    .catch(next);
}

function computeCatalogsMetrics(req, res, next) {
  let count;

  Catalog.find().exec()
    .then(catalogs => {
      count = catalogs.length;
      return Promise.map(catalogs, catalog => catalog.computeMetricsAndSave(), { concurrency: 5 });
    })
    .then(() => res.send({ task: 'compute-catalogs-metrics', count }))
    .catch(next);
}

function checkRemoteResources(req, res, next) {
  const reqLimit = parseInt(req.query.limit);
  const limit = isNumber(reqLimit) && reqLimit > 0 ? reqLimit : 100;

  RemoteResource.checkMany({ limit })
    .then(({ count }) => res.status(202).send({ task: 'check-remote-resources', count }))
    .catch(next);
}

module.exports = { consolidateRecords, processAllRecords, computeCatalogsMetrics, checkRemoteResources };
