import { createServer } from 'http';

import BitScoop from 'bitscoop-sdk';
import bodyParser from 'body-parser';
import config from 'config';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import expressPlayground from 'graphql-playground-middleware-express';
import {graphqlExpress, graphiqlExpress} from 'apollo-server-express';
import { PubSub } from 'graphql-subscriptions';
import { execute, subscribe } from 'graphql';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import mongoose from 'mongoose';
import {Nuxt, Builder} from 'nuxt';

import views from './lib/views';
import cookieAuthorization from './lib/middleware/cookie-authorization';
import meta from './lib/middleware/meta';
import {crudAPI} from './schema';
import {loadValidator} from './lib/validator';
import nuxtConfig from './nuxt.config.js';

const MONGODB_URI = config.mongodb.address;
const BITSCOOP_API_KEY = config.bitscoop.api_key;

const server = express();
const wsServer = createServer(function(req, res) {
	res.writeHead(200);
	res.end();
});

wsServer.listen(3001, function() {
	console.log('WS Server running on ' + 3001);
	SubscriptionServer.create({
		schema: crudAPI.schema,
		execute: execute,
		subscribe: subscribe
	}, {
		server: wsServer,
		path: '/subscriptions'
	});
});

const opts = {
	autoReconnect: true,
	reconnectTries: Number.MAX_VALUE,
	reconnectInterval: 1000,
};

const bitscoop = new BitScoop(BITSCOOP_API_KEY, {
	allowUnauthorized: true
});

server.use(cors());

mongoose.connect(MONGODB_URI, opts);

const mongooseConnect = mongoose.connection;

const nuxt = new Nuxt(nuxtConfig);

const builder = new Builder(nuxt);

const pubSub = new PubSub();


mongooseConnect.on('error', e => {
	if (e.message.code === 'ETIMEDOUT') {
		console.log(e);
		mongoose.connect(MONGODB_URI, opts);
	}
	console.log(e);
});

mongooseConnect.once('open', () => {
	console.log(`MongoDB successfully connected to ${MONGODB_URI}`);
});

loadValidator(config.validationSchemas)
	.then(async function (validate) {
		global.env = {
			bitscoop: bitscoop,
			validate: validate,
			pubSub: pubSub
		};

		builder.build();

		server.use(
			crudAPI.uri,
			bodyParser.json(),
			cookieParser(),
			cookieAuthorization,
			graphqlExpress((req, res) => ({
				schema: crudAPI.schema,
				tracing: true,
				context: {req, res},
				formatError: error => ({
					message: error.message,
					locations: error.locations,
					stack: error.stack ? error.stack.split('\n') : [],
					path: error.path
				})
			})));


		// http://localhost:3000/gql-i/
		server.get(`${crudAPI.uri}-i`, graphiqlExpress({
			endpointURL: crudAPI.uri,
			subscriptionsEndpoint: 'wss://app.lifescope.io/subscriptions'
		}));

		// http://localhost:3000/gql-p/
		server.get(`${crudAPI.uri}-p`, expressPlayground({endpoint: crudAPI.uri}));

		server.use(
			'/',
			meta,
			bodyParser.json(),
			cookieParser(),
			cookieAuthorization,
			views
		);

		server.use(nuxt.render);

		// http://localhost:3000/user/
		// server.listen(3000);
		server.listen(3000);

		console.log('Lifescope API listening on: ' + 3000);
	});
