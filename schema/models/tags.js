/* @flow */

// TODO: FIXXX
import _ from 'lodash';
import composeWithMongoose from 'graphql-compose-mongoose/node8';
import mongoose from 'mongoose';

import uuid from "../../lib/util/uuid";

export const TagsSchema = new mongoose.Schema(
	{
		_id: {
			type: Buffer
		},

		id: {
			type: String,
			get: function() {
				if (this._id) {
					return this._id.toString('hex');
				}
			},
			set: function(val) {
				if (this._conditions && this._conditions.id) {
					if (this._conditions.id.hasOwnProperty('$in')) {
						this._conditions._id = {
							$in: _.map(this._conditions.id.$in, function(item) {
								return uuid(item);
							})
						};
					}
					else {
						this._conditions._id = uuid(val);
					}

					delete this._conditions.id;
				}

				if (val.hasOwnProperty('$in')) {
					this._id = {
						$in: _.map(val.$in, function(item) {
							return uuid(item);
						})
					};

				}
				else {
					this._id = uuid(val);
				}
			}
		},

		created: {
			type: Date,
			default: Date.now
		},

		tag: {
			type: String
		},

		share: {
			type: String
		},

		passcode: {
			type: Buffer
		},

		passcode_string: {
			type: String,
			get: function() {
				if (this.passcode) {
					return this.passcode.toString('hex')
				}
				else {
					return null;
				}
			},
			set: function(val) {
				if (val && this._conditions && this._conditions.passcode_string) {
					this._conditions.passcode = uuid(val);

					delete this._conditions.passcode_string;
				}

				this.passcode = uuid(val);
			}
		},

		updated: {
			type: Date
		},

		user_id: {
			type: Buffer
		},

		user_id_string: {
			type: String,
			get: function() {
				return this._id.toString('hex')
			},
			set: function(val) {
				if (val && this._conditions && this._conditions.user_id_string) {
					this._conditions.user_id = uuid(val);

					delete this._conditions.user_id_string;
				}

				this.user_id = uuid(val);
			}
		}
	},
	{
		collection: 'tags',
	}
);

export const Tags = mongoose.model('Tags', TagsSchema);

export const TagTC = composeWithMongoose(Tags);


TagTC.addResolver({
	name: 'updateSharing',
	kind: 'mutation',
	args: {
		id: 'String',
		share: 'String'
	},
	type: TagTC.getResolver('findOne').getType(),
	resolve: async function({source, args, context, info}) {
		let validate = env.validate;

		try {
			await validate('#/mutations/tag-sharing', args.share)
		} catch(err) {
			throw httpErrors(400);
		}

		let record = {
			share: args.share
		};

		if (args.share === 'public') {
			record.passcode = uuid(uuid());
		}
		else if (args.share === 'none' || args.share == null) {
			record.passcode = null;
		}

		let result = await TagTC.getResolver('updateOne').resolve({
			args: {
				filter: {
					id: args.id,
					user_id_string: context.req.user._id.toString('hex')
				},
				record: record
			}
		});

		return result.record;
	}
});

