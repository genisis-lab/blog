export const PLUGIN_KV_PREFIX_SQL =
	"SELECT id, data FROM _plugin_storage WHERE plugin_id = ? AND collection = '__kv' AND substr(id, 1, length(?)) = ?";
