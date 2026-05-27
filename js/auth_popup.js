
import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

const PLUGIN_NAME = "ComfyUI_shaobkj-kyjd";
const STATUS_URL = `/shaobkj/release_auth/${encodeURIComponent(PLUGIN_NAME)}/status`;
const ACTIVATE_URL = `/shaobkj/release_auth/${encodeURIComponent(PLUGIN_NAME)}/activate`;

function showMessage(message) {
    if (app?.ui?.dialog?.show) {
        app.ui.dialog.show(message);
        return;
    }
    alert(message);
}

async function requestAuth() {
    const statusResponse = await api.fetchApi(STATUS_URL);
    const statusData = await statusResponse.json();
    if (statusData?.authorized) return;

    const accessKey = prompt(`${PLUGIN_NAME} 首次运行需要输入授权码：`);
    if (!accessKey) {
        showMessage(`${PLUGIN_NAME} 未输入授权码，节点运行会被拦截。`);
        return;
    }

    const response = await api.fetchApi(ACTIVATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_key: accessKey }),
    });
    const data = await response.json();
    if (!response.ok || !data?.authorized) {
        showMessage(data?.message || `${PLUGIN_NAME} 授权失败，请重新启动后再次输入。`);
        return;
    }
    showMessage(`${PLUGIN_NAME} 授权成功。`);
}

app.registerExtension({
    name: `shaobkj.release_auth.${PLUGIN_NAME}`,
    async setup() {
        setTimeout(() => requestAuth().catch((error) => showMessage(String(error?.message || error))), 500);
    },
});
