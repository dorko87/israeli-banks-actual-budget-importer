/* eslint-disable unicorn/no-process-exit */

/* eslint-disable no-await-in-loop */
/* eslint-disable n/file-extension-in-import */

import process from 'node:process';
import {type CompanyTypes} from 'israeli-bank-scrapers';
import _ from 'lodash';
import actual from '@actual-app/api';
import Queue from 'p-queue';
import moment from 'moment';
import cron, {type ScheduledTask, validate} from 'node-cron';
import cronstrue from 'cronstrue';
import config from '../config.json' assert {type: 'json'};
import type {ConfigBank} from './config.d.ts';
import {scrapeAndImportTransactions} from './utils.ts';

let scheduledTask: ScheduledTask;

async function run() {
	const queue = new Queue({
		concurrency: 10,
		autoStart: true,
		interval: 1000,
		intervalCap: 10,
	});

	await actual.init(config.actual.init);
	await actual.downloadBudget(config.actual.budget.syncId, config.actual.budget);

	for (const [companyId, bank] of _.entries(config.banks) as Array<[CompanyTypes, ConfigBank]>) {
		await queue.add(async () => scrapeAndImportTransactions({companyId, bank}));
	}

	await queue.onIdle();
	await actual.shutdown();

	console.log('Done');
}

async function safeRun() {
	try {
		await run();
	} catch (error) {
		console.error('Error running scraper:', error);
	} finally {
		if (scheduledTask) {
			printNextRunTime();
		}
	}
}

function printNextRunTime() {
	const nextRun = scheduledTask.getNextRun();
	console.log('Next run:', moment(nextRun).fromNow(), 'at', moment(nextRun).format('YYYY-MM-DD HH:mm:ss'));
}

if (process.env?.SCHEDULE) {
	if (!validate(process.env.SCHEDULE)) {
		throw new Error(`Invalid cron schedule: ${process.env?.SCHEDULE}`);
	}

	console.log('Started scheduled run:', process.env?.SCHEDULE, `(${cronstrue.toString(process.env?.SCHEDULE)})`);
	scheduledTask = cron.schedule(process.env.SCHEDULE, safeRun);

	printNextRunTime();
} else {
	await safeRun().finally(() => {
		setTimeout(() => process.exit(0), moment.duration(5, 'seconds').asMilliseconds());
	});
}
