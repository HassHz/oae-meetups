/*!
 * Copyright 2014 Apereo Foundation (AF) Licensed under the
 * Educational Community License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may
 * obtain a copy of the License at
 *
 *     http://opensource.org/licenses/ECL-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an "AS IS"
 * BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

var _ = require('underscore');

var ActivityAPI = require('oae-activity');
var ActivityConstants = require('oae-activity/lib/constants').ActivityConstants;
var ActivityModel = require('oae-activity/lib/model');
var ActivityUtil = require('oae-activity/lib/util');
var AuthzConstants = require('oae-authz/lib/constants').AuthzConstants;
var TenantsUtil = require('oae-tenants/lib/util');
var User = require('oae-principals/lib/model').User;

var MeetupsAPI = require('./api');
var MeetupsConstants = require('./constants').MeetupsConstants;
var MeetupsDAO = require('./internal/dao');

var sha1 = require('sha1');

ActivityAPI.registerActivityType(MeetupsConstants.activity.ACTIVITY_MEETUP_JOIN, {
    'groupBy': [{'object': true}],
    'streams': {
        'activity': {
            'router': {
                'actor': ['self', 'followers'],
                'object': ['self', 'members']
            }
        },
        'notification': {
            'router': {
                'object': ['managers']
            }
        }
    }
});

/*!
 * Post a meetup-join activity when a user joins a meetup.
 */
MeetupsAPI.on(MeetupsConstants.events.JOIN_MEETUP, function(ctx, group) {
    // var millis = Date.now();
    // var actorResource = new ActivityModel.ActivitySeedResource('user', ctx.user().id, {'user': ctx.user()});
    // var objectResource = new ActivityModel.ActivitySeedResource('group', group.id, {'group': group});
    // var activityType = MeetupsConstants.activity.ACTIVITY_MEETUP_JOIN;
    // 
    // var activitySeed = new ActivityModel.ActivitySeed(activityType, millis, ActivityConstants.verbs.POST, actorResource, objectResource);
    // ActivityAPI.postActivity(ctx, activitySeed);
    var bbbConfig = MeetupsAPI.Bbb.getBBBConfig(ctx.tenant().alias);
    var meetingID = sha1(group.id + bbbConfig.secret);
    
    MeetupsDAO.getMeetup(meetingID, function(err, meetup) {
        if(err){
            log().info("cry");
        }
        meetup.displayName = group.displayName;
        var millis = Date.now();
        var actorResource = new ActivityModel.ActivitySeedResource('user', ctx.user().id, {'user': ctx.user()});
        var objectResource = new ActivityModel.ActivitySeedResource('meetup', meetup.id, {'meetup': meetup});
        var activitySeed = new ActivityModel.ActivitySeed(MeetupsConstants.activity.ACTIVITY_MEETUP_JOIN, millis, ActivityConstants.verbs.POST, actorResource, objectResource);
        ActivityAPI.postActivity(ctx, activitySeed);
    });
});

///////////////////////////
// ACTIVITY ENTITY TYPES //
///////////////////////////

/*!
 * Produces a persistent 'meetup' activity entity
 * @see ActivityAPI#registerActivityEntityType
 */
var _meetupProducer = function(resource, callback) {
    var meetup = (resource.resourceData && resource.resourceData.meetup) ? resource.resourceData.meetup : null;

    // If the meetup item was fired with the resource, use it instead of fetching
    if (meetup) {
        return callback(null, _createPersistentMeetupActivityEntity(meetup));
    }

    MeetupsDAO.getMeetup(resource.resourceId, function(err, meetup) {
        if (err) {
            return callback(err);
        }
        meetup.visibility = AuthzConstants.visibility.PUBLIC;
        return callback(null, _createPersistentMeetupActivityEntity(meetup));
    });
};

/**
 * Create the persistent meetup entity that can be transformed into an activity entity for the UI.
 *
 * @param  {Meetup}     meetup      The meetup that provides the data for the entity.
 * @return {Object}                         An object containing the entity data that can be transformed into a UI meetup activity entity
 * @api private
 */
var _createPersistentMeetupActivityEntity = function(meetup) {
    return new ActivityModel.ActivityEntity('meetup', meetup.id, meetup.visibility, {'meetup': meetup});
};

/*!
 * Transform the meetup persistent activity entities into UI-friendly ones
 * @see ActivityAPI#registerActivityEntityType
 */
var _meetupTransformer = function(ctx, activityEntities, callback) {
    var transformedActivityEntities = {};

    var allRevisionIds = [];
    _.each(activityEntities, function(entities, activityId) {
        transformedActivityEntities[activityId] = transformedActivityEntities[activityId] || {};
        _.each(entities, function(entity, entityId) {
            // Transform the persistent entity into an ActivityStrea.ms compliant format
            transformedActivityEntities[activityId][entityId] = _transformPersistentMeetupActivityEntity(ctx, entity);
        });
    });
    return callback(null, transformedActivityEntities);
};

/*!
 * Transform the meetup persistent activity entities into their OAE profiles
 * @see ActivityAPI#registerActivityEntityType
 */
var _meetupInternalTransformer = function(ctx, activityEntities, callback) {
    var transformedActivityEntities = {};

    var allRevisionIds = [];
    _.each(activityEntities, function(entities, activityId) {
        transformedActivityEntities[activityId] = transformedActivityEntities[activityId] || {};
        _.each(entities, function(entity, entityId) {
            // Transform the persistent entity into the OAE model
            transformedActivityEntities[activityId][entityId] = entity.meetup;
        });
    });
    return callback(null, transformedActivityEntities);
};

/**
 * Transform a meetup object into an activity entity suitable to be displayed in an activity stream.
 *
 * For more details on the transformed entity model, @see ActivityAPI#registerActivityEntityTransformer
 *
 * @param  {Context}           ctx         Standard context object containing the current user and the current tenant
 * @param  {Object}            entity      The persistent activity entity to transform
 * @return {ActivityEntity}                The activity entity that represents the given meetup item
 */
var _transformPersistentMeetupActivityEntity = function(ctx, entity) {
    var meetup = entity.meetup;

    // Generate URLs for this activity
    var tenant = ctx.tenant();
    var baseUrl = TenantsUtil.getBaseUrl(tenant);
    var globalId = baseUrl + '/group/guest/HkfP-F2Xx';
    var profileUrl = baseUrl + '/api/meetup/g:guest:HkfP-F2Xx/join';

    var opts = {};
    opts.url = globalId;
    opts.displayName = meetup.displayName;
    opts.ext = {};
    opts.ext[ActivityConstants.properties.OAE_ID] = meetup.id;
    opts.ext[ActivityConstants.properties.OAE_VISIBILITY] = AuthzConstants.visibility.PUBLIC;
    opts.ext[ActivityConstants.properties.OAE_PROFILEPATH] = '/api/meetup/g:guest:HkfP-F2Xx/join';
    return new ActivityModel.ActivityEntity('meetup', globalId, AuthzConstants.visibility.PUBLIC, opts);
};

ActivityAPI.registerActivityEntityType('meetup', {
    'producer': _meetupProducer,
    'transformer': {
        'activitystreams': _meetupTransformer,
        'internal': _meetupInternalTransformer
    },
    'propagation': function(associationsCtx, entity, callback) {
        ActivityUtil.getStandardResourcePropagation(AuthzConstants.visibility.PUBLIC, AuthzConstants.joinable.NO, callback);
    }
});


//////////////////////////////////
// ACTIVITY ENTITY ASSOCIATIONS //
//////////////////////////////////

/*!
 * Register an association that presents the meetup
 */
ActivityAPI.registerActivityEntityAssociation('meetup', 'self', function(associationsCtx, entity, callback) {
    return callback(null, [entity[ActivityConstants.properties.OAE_ID]]);
});
