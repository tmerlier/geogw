/*eslint no-multi-spaces: 0, key-spacing: 0 */
const mongoose = require('mongoose');
const { Schema } = require('mongoose');
const sidekick = require('../helpers/sidekick');
const pick = require('lodash/object/pick');

const Mixed = Schema.Types.Mixed;


const collectionName = 'record_revisions';

const schema = new Schema({

    /* Identification */
    recordId:     { type: String, required: true },
    recordHash:   { type: String, required: true },

    /* Attributes */
    revisionDate: { type: Date },

    /* Content */
    recordType:    { type: String, enum: ['MD_Metadata', 'Record', 'FC_FeatureCatalog'] },
    content:      { type: Mixed, required: true },

    /* Dates */
    createdAt:    { type: Date },
    touchedAt:    { type: Date }
});

/*
** Indexes
*/

schema.index({ recordId: 1, recordHash: 1 }, { unique: true });

/*
** Statics
*/
schema.statics = {

    triggerUnprocessed: function (recordRevision) {
        return sidekick('process-record', pick(recordRevision, 'recordId', 'recordHash'));
    },

    upsert: function (recordRevision) {
        const now = new Date();
        var query = pick(recordRevision, 'recordId', 'recordHash');
        var changes = {
            $setOnInsert: {
                content: recordRevision.content,
                recordType: recordRevision.recordType,
                revisionDate: recordRevision.revisionDate,
                createdAt: now
            },
            $set: {
                touchedAt: now
            }
        };

        return this.update(query, changes, { upsert: true }).exec()
            .then(rawResponse => rawResponse.upserted ? 'created' : 'touched')
            .then(upsertStatus => {
                if (upsertStatus === 'touched') return 'touched';
                return this.triggerUnprocessed(recordRevision).return(upsertStatus);
            });
    }

};

const model = mongoose.model('RecordRevision', schema, collectionName);

module.exports = { model, collectionName, schema };
