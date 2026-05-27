import { app } from "/scripts/app.js";

let textLoopSetupDone = false;
let textLoopApiListenerBound = false;
let textLoopQueueRunning = false;
let textLoopQueueRequested = false;



function isTextLoopNode(node) {
    const t = node?.type || "";
    const title = node?.title || "";
    return t === "Shaobkj_Text_Loop" || (typeof title === "string" && title.includes("文本循环"));
}

function findWidgetByNames(node, names) {
    if (!node?.widgets || !Array.isArray(node.widgets)) return null;
    for (const name of names) {
        const widget = node.widgets.find((w) => w && (w.name === name || w.label === name));
        if (widget) return widget;
    }
    return null;
}

function setWidgetDisabledState(widget, disabled) {
    let changed = false;
    if (widget.disabled !== disabled) {
        widget.disabled = disabled;
        changed = true;
    }
    if (!widget.options) {
        widget.options = {};
        changed = true;
    }
    if (widget.options.disabled !== disabled) {
        widget.options.disabled = disabled;
        changed = true;
    }
    if (widget.options.readOnly !== disabled) {
        widget.options.readOnly = disabled;
        changed = true;
    }
    return changed;
}

function setWidgetHiddenState(widget, hidden) {
    if (!widget) return false;
    let changed = false;
    const nextType = hidden ? "hidden" : (widget.__shaobkjOriginalType || widget.type || "number");
    if (!widget.__shaobkjOriginalType) {
        widget.__shaobkjOriginalType = widget.type || "number";
    }
    if (!widget.__shaobkjOriginalComputeSize && typeof widget.computeSize === "function") {
        widget.__shaobkjOriginalComputeSize = widget.computeSize;
    }
    if (!widget.__shaobkjHiddenComputeSize) {
        widget.__shaobkjHiddenComputeSize = () => [0, -4];
    }
    if (hidden) {
        if (widget.type !== nextType) {
            widget.type = nextType;
            changed = true;
        }
        if (widget.computeSize !== widget.__shaobkjHiddenComputeSize) {
            widget.computeSize = widget.__shaobkjHiddenComputeSize;
            changed = true;
        }
    } else {
        if (widget.type !== nextType) {
            widget.type = nextType;
            changed = true;
        }
        const originalComputeSize = widget.__shaobkjOriginalComputeSize;
        if (originalComputeSize && widget.computeSize !== originalComputeSize) {
            widget.computeSize = originalComputeSize;
            changed = true;
        }
    }
    return changed;
}

function getLinkedTextValue(node, inputName) {
    try {
        if (!node || !node.graph || !Array.isArray(node.inputs)) {
            return null;
        }
        const input = node.inputs.find((item) => item && item.name === inputName);
        if (!input || input.link == null) {
            return null;
        }
        const link = node.graph.links && node.graph.links[input.link];
        if (!link) {
            return null;
        }
        const originNode = node.graph.getNodeById ? node.graph.getNodeById(link.origin_id) : null;
        if (!originNode || !Array.isArray(originNode.widgets)) {
            return null;
        }
        for (const widget of originNode.widgets) {
            if (typeof widget?.value === "string") {
                return widget.value;
            }
        }
        return null;
    } catch {
        return null;
    }
}

function getTextLoopSourceText(node) {
    const linkedText = getLinkedTextValue(node, "文本");
    if (typeof linkedText === "string" && linkedText !== "") {
        return linkedText;
    }
    const textWidget = findWidgetByNames(node, ["文本"]);
    return textWidget ? String(textWidget.value ?? "") : "";
}

function getTextLoopMaxLineCount(node) {
    const textValue = getTextLoopSourceText(node);
    if (!textValue) return 0;
    const lines = textValue.split(/\r?\n/);
    return lines.filter((line) => String(line).trim() !== "").length;
}

function initializeTextLoopState(node) {
    if (!isTextLoopNode(node) || !node.widgets) return false;
    const startWidget = findWidgetByNames(node, ["计数开始"]);
    const endWidget = findWidgetByNames(node, ["计数结束"]);
    const stateWidget = findWidgetByNames(node, ["当前执行编号"]);
    if (!startWidget || !endWidget || !stateWidget) return false;
    const maxLines = getTextLoopMaxLineCount(node);
    const startValue = Math.max(0, Number(startWidget.value ?? 0));
    const nextState = maxLines > 0 ? Math.min(startValue, maxLines - 1) : 0;
    let changed = false;
    if (Number(endWidget.value ?? 0) !== maxLines) {
        endWidget.value = maxLines;
        changed = true;
    }
    if (stateWidget.value !== nextState) {
        stateWidget.value = nextState;
        changed = true;
    }
    node.__shaobkjTextLoopLastText = getTextLoopSourceText(node);
    node.__shaobkjTextLoopInitialized = true;
    node.__shaobkjTextLoopListEnabled = Boolean(findWidgetByNames(node, ["列表"])?.value);
    node.__shaobkjTextLoopLastStartValue = startValue;
    if (changed) {
        node.onResize?.(node.size);
        node.setDirtyCanvas(true, true);
    }
    return changed;
}

function setupTextLoopListMode(node) {
    if (!isTextLoopNode(node)) return false;
    if (!node.widgets || !Array.isArray(node.outputs) || node.outputs.length < 3) return false;
    const listWidget = findWidgetByNames(node, ["列表"]);
    const startWidget = findWidgetByNames(node, ["计数开始"]);
    const endWidget = findWidgetByNames(node, ["计数结束"]);
    const modeWidget = findWidgetByNames(node, ["mode"]);
    const stateWidget = findWidgetByNames(node, ["当前执行编号"]);
    if (!listWidget) return false;
    const totalOutput = node.outputs[1];
    const currentOutput = node.outputs[2];
    if (!totalOutput || !currentOutput) return false;
    const enabled = Boolean(listWidget.value);
    const totalOutputName = enabled ? "输出列表数" : "输出列表数（已禁用）";
    const currentOutputName = enabled ? "当前执行编号" : "当前执行编号（已禁用）";
    let changed = false;
    const startValue = Number(startWidget?.value ?? 0);
    if (totalOutput.name !== totalOutputName) {
        totalOutput.name = totalOutputName;
        changed = true;
    }
    if (totalOutput.label !== totalOutputName) {
        totalOutput.label = totalOutputName;
        changed = true;
    }
    if (totalOutput.disabled !== !enabled) {
        totalOutput.disabled = !enabled;
        changed = true;
    }
    if (currentOutput.name !== currentOutputName) {
        currentOutput.name = currentOutputName;
        changed = true;
    }
    if (currentOutput.label !== currentOutputName) {
        currentOutput.label = currentOutputName;
        changed = true;
    }
    if (currentOutput.disabled !== !enabled) {
        currentOutput.disabled = !enabled;
        changed = true;
    }
    if (startWidget) {
        changed = setWidgetDisabledState(startWidget, !enabled) || changed;
    }
    if (modeWidget) {
        changed = setWidgetDisabledState(modeWidget, !enabled) || changed;
        if (modeWidget.label !== "计数模式") {
            modeWidget.label = "计数模式";
            changed = true;
        }
    }
    if (endWidget) {
        changed = setWidgetDisabledState(endWidget, !enabled) || changed;
    }
    if (stateWidget) {
        changed = setWidgetHiddenState(stateWidget, false) || changed;
        stateWidget.readonly = true;
    }
    const previousEnabled = node.__shaobkjTextLoopListEnabled;
    const previousStartValue = node.__shaobkjTextLoopLastStartValue;
    if (stateWidget && startWidget) {
        const stateValue = Number(stateWidget.value ?? 0);
        const shouldInitializeState = node.__shaobkjTextLoopInitialized !== true
            || previousEnabled !== enabled
            || previousStartValue !== startValue;
        if (!Number.isNaN(startValue) && (shouldInitializeState || stateValue < startValue)) {
            stateWidget.value = startValue;
            changed = true;
        }
    }
    node.__shaobkjTextLoopInitialized = true;
    node.__shaobkjTextLoopListEnabled = enabled;
    node.__shaobkjTextLoopLastStartValue = startValue;
    if (typeof node.__shaobkjTextLoopLastText !== "string") {
        node.__shaobkjTextLoopLastText = getTextLoopSourceText(node);
    }
    if (changed) {
        node.onResize?.(node.size);
        node.setDirtyCanvas(true, true);
    }
    return changed;
}

function setupTextLoopInitButton(node) {
    if (!isTextLoopNode(node) || !node.widgets) return false;
    const index = node.widgets.findIndex((w) => w.name === "初始化");
    if (index === -1) {
        const newWidget = node.addWidget("button", "初始化", "Init", () => {
            initializeTextLoopState(node);
        });
        newWidget.name = "初始化";
        newWidget.label = "⟳ 初始化";
        newWidget.tooltip = "按当前文本重新计算去空行后的最大列表行数，并初始化计数";
        newWidget.serialize = false;
        node.setDirtyCanvas(true, true);
        return true;
    }
    const widget = node.widgets[index];
    const isLast = index === node.widgets.length - 1;
    const isCorrect = widget.type === "button" && widget.label === "⟳ 初始化" && widget.callback;
    widget.callback = () => {
        initializeTextLoopState(node);
    };
    widget.tooltip = "按当前文本重新计算去空行后的最大列表行数，并初始化计数";
    if (isCorrect && isLast) {
        return false;
    }
    if (isCorrect && !isLast) {
        node.widgets.splice(index, 1);
        node.widgets.push(widget);
        node.setDirtyCanvas(true, true);
        return true;
    }
    node.widgets.splice(index, 1);
    const newWidget = node.addWidget("button", "初始化", "Init", () => {
        initializeTextLoopState(node);
    });
    newWidget.name = "初始化";
    newWidget.label = "⟳ 初始化";
    newWidget.tooltip = "按当前文本重新计算去空行后的最大列表行数，并初始化计数";
    newWidget.serialize = false;
    node.setDirtyCanvas(true, true);
    const stateWidget = findWidgetByNames(node, ["当前执行编号"]);
    if (stateWidget) {
        stateWidget.readonly = true;
        stateWidget.disabled = true;
    }
    return true;
}

app.registerExtension({
    name: "shaobkj.text_loop",
    async setup() {
        if (textLoopSetupDone) return;
        textLoopSetupDone = true;
        const tick = () => {
            const nodes = app?.graph?._nodes;
            if (!nodes || !Array.isArray(nodes)) {
                return;
            }
            for (const node of nodes) {
                if (!isTextLoopNode(node)) continue;
                setupTextLoopInitButton(node);
                setupTextLoopListMode(node);
                const currentSourceText = getTextLoopSourceText(node);
                if (node.__shaobkjTextLoopLastText !== currentSourceText) {
                    initializeTextLoopState(node);
                }
            }
        };
        setTimeout(tick, 200);
        window.setInterval(tick, 400);

        import("/scripts/api.js").then(({ api }) => {
            if (textLoopApiListenerBound) return;
            textLoopApiListenerBound = true;
            api.addEventListener("shaobkj_text_loop.node_feedback", (evt) => {
                const detail = evt && evt.detail ? evt.detail : null;
                const nodeId = detail && detail.node_id ? String(detail.node_id) : "";
                const widgetName = detail && detail.widget_name ? String(detail.widget_name) : "";
                const value = detail ? detail.value : undefined;
                const node = app?.graph?._nodes_by_id?.[nodeId];
                if (!node || !Array.isArray(node.widgets)) {
                    return;
                }
                const widget = node.widgets.find((w) => w && w.name === widgetName);
                if (!widget) {
                    return;
                }
                widget.value = value;
                if (typeof widget.callback === "function") {
                    widget.callback(value);
                }
                node.setDirtyCanvas?.(true, true);
            });
            const runTextLoopQueue = async () => {
                if (textLoopQueueRunning) {
                    textLoopQueueRequested = true;
                    return;
                }
                textLoopQueueRunning = true;
                try {
                    do {
                        textLoopQueueRequested = false;
                        await new Promise((resolve) => setTimeout(resolve, 100));
                        await app.queuePrompt(0, 1);
                    } while (textLoopQueueRequested);
                } finally {
                    textLoopQueueRunning = false;
                }
            };
            api.addEventListener("shaobkj_text_loop.add_queue", () => {
                runTextLoopQueue();
            });
        }).catch(() => {
        });
    },
    async init(app) {
        return this.setup(app);
    },
    async beforeRegisterNodeDef(nodeType, nodeData) {
        const isTargetNode = nodeData?.name === "Shaobkj_Text_Loop";
        if (!isTargetNode) return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
            setTimeout(() => {
                setupTextLoopListMode(this);
                initializeTextLoopState(this);
            }, 50);
            return r;
        };

        const onConnectionsChange = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function (type, index, connected, link_info, slot) {
            const r = onConnectionsChange ? onConnectionsChange.apply(this, arguments) : undefined;
            if (type === 1) {
                setTimeout(() => {
                    setupTextLoopInitButton(this);
                    setupTextLoopListMode(this);
                    initializeTextLoopState(this);
                }, 50);
            }
            return r;
        };

        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = onConfigure ? onConfigure.apply(this, arguments) : undefined;
            setTimeout(() => {
                setupTextLoopInitButton(this);
                setupTextLoopListMode(this);
                initializeTextLoopState(this);
            }, 50);
            return r;
        };

        const onWidgetChanged = nodeType.prototype.onWidgetChanged;
        nodeType.prototype.onWidgetChanged = function (name, value, oldValue, widget) {
            const r = onWidgetChanged ? onWidgetChanged.apply(this, arguments) : undefined;
            if (name === "计数开始") {
                const stateWidget = findWidgetByNames(this, ["当前执行编号"]);
                if (stateWidget && stateWidget.value !== value) {
                    stateWidget.value = value;
                }
            }
            if (name === "文本") {
                const textValue = String(value ?? "");
                if (this.__shaobkjTextLoopLastText !== textValue) {
                    initializeTextLoopState(this);
                }
            }
            setupTextLoopListMode(this);
            return r;
        };
    }
});
