import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { PLUGIN_KV_PREFIX_SQL } from "../src/plugins/kv-prefix.ts";

test("long contact rate-limit prefixes match only the owning plugin's KV records", () => {
	const db = new DatabaseSync(":memory:");
	try {
		db.exec("CREATE TABLE _plugin_storage (plugin_id TEXT, collection TEXT, id TEXT, data TEXT)");
		const insert = db.prepare("INSERT INTO _plugin_storage VALUES (?, ?, ?, ?)");
		const prefix = `state:rate-limit:${"f".repeat(36)}:${"a".repeat(64)}:`;
		insert.run("contact", "__kv", `${prefix}2026-10-04`, '{"count":1}');
		insert.run("other", "__kv", `${prefix}2026-10-04`, '{"count":2}');
		insert.run("contact", "forms", `${prefix}2026-10-04`, '{"count":3}');
		insert.run("contact", "__kv", "unrelated", '{"count":4}');
		const rows = db.prepare(PLUGIN_KV_PREFIX_SQL).all("contact", prefix, prefix);
		assert.equal(rows.length, 1);
		assert.equal(rows[0].data, '{"count":1}');
	} finally { db.close(); }
});

test("percent and underscore in a KV prefix are literal characters", () => {
	const db = new DatabaseSync(":memory:");
	try {
		db.exec("CREATE TABLE _plugin_storage (plugin_id TEXT, collection TEXT, id TEXT, data TEXT)");
		const insert = db.prepare("INSERT INTO _plugin_storage VALUES (?, ?, ?, ?)");
		insert.run("contact", "__kv", "rate%_:one", "1");
		insert.run("contact", "__kv", "rateXX:two", "2");
		const rows = db.prepare(PLUGIN_KV_PREFIX_SQL).all("contact", "rate%_:", "rate%_:");
		assert.equal(rows.length, 1);
		assert.equal(rows[0].id, "rate%_:one");
	} finally { db.close(); }
});
