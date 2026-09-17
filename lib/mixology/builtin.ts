// lib/mixology/builtin.ts
// 独家特调 · 官方出厂材料：序言/基底/杯型/核对的默认文案，以及一件示范机括「朗读」。
// 这几件是"素杯也好喝"的底线——玩家一件配料不装、只拿一张角色卡也能开局。
// 文案升级时 bump MIX_BUILTIN_VERSION，storage 会用出厂内容刷新官方件。

import type { MixMechanismMaterial, MixTextMaterial } from "./types";

export const MIX_BUILTIN_VERSION = 5;

export const MIX_BUILTIN_PREFACE_ID = "mix_builtin_preface";
export const MIX_BUILTIN_BASE_ID = "mix_builtin_base";
export const MIX_BUILTIN_GLASS_ID = "mix_builtin_glass";
export const MIX_BUILTIN_CHECKLIST_ID = "mix_builtin_checklist";
export const MIX_BUILTIN_VOICE_CONSOLE_ID = "mix_builtin_voice_console";

const now = () => Date.now();

/**
 * 官方序言：提示词最顶上的开场说明（历史上曾硬编码在组装器里的那段固定文案）。
 * 与基底/杯型同规则：槽位里选了才生效，没配提示词就没有这一段，不做暗兜底。
 * 「越靠后的要求优先级越高」是段落排序的配套约定，自建序言时也建议保留。
 */
export function createBuiltinPreface(): MixTextMaterial {
    return {
        id: MIX_BUILTIN_PREFACE_ID,
        kind: "preface",
        name: "官方 · 标准序言",
        hook: "出厂自带的开场声明，点明扮演与优先级",
        author: "独家特调",
        content: "这是一场沉浸式角色扮演，你要扮演的角色是{{char}}。下方依次给出扮演规则、角色资料与输出要求，请全部遵守；越靠后的要求优先级越高。\n（# 为分段，## 为该段下的具体条目；更深的层级来自创作者自己的分层。）",
        tags: ["官方"],
        createdAt: now(),
        updatedAt: now(),
    };
}

/** 官方基底：扮演总纲 */
export function createBuiltinBase(): MixTextMaterial {
    return {
        id: MIX_BUILTIN_BASE_ID,
        kind: "base",
        name: "官方 · 标准扮演",
        hook: "出厂自带的扮演总纲，稳定不出戏",
        author: "独家特调",
        content: [
            "你将完全成为「{{char}}」，以第一视角活在故事里，与「{{user}}」进行沉浸式角色扮演。",
            "- 始终以{{char}}的身份、性格、说话方式行动，绝不跳出角色、绝不以 AI 或助手自称。",
            "- 只扮演{{char}}与故事中的旁白/配角，绝不代替{{user}}说话、行动或下决定。",
            "- 依据角色资料与已发生的剧情推进故事，主动推动情节，不原地打转，不重复已说过的内容。",
            "- 角色资料没写的细节可以合理补全，但不得与已有设定矛盾。",
            "- 允许剧情出现冲突、拒绝与负面情绪，角色不是讨好机器；贴合人设比讨好{{user}}更重要。",
        ].join("\n"),
        tags: ["官方"],
        createdAt: now(),
        updatedAt: now(),
    };
}

/** 官方杯型：输出格式（含正文语义协议的书写引导） */
export function createBuiltinGlass(): MixTextMaterial {
    return {
        id: MIX_BUILTIN_GLASS_ID,
        kind: "glass",
        name: "官方 · 正文与对白",
        hook: "出厂自带的输出格式，正文流畅、对白分明",
        author: "独家特调",
        content: [
            "以小说正文的形式输出，第三人称叙述，每轮 2~4 个自然段，段落之间空一行。",
            "- 叙述里穿插动作、神态与环境细节，让画面能被看见；不要写成流水账。",
            "- 每轮在留有余韵处收笔，给{{user}}接话的空间；不要替{{user}}总结感受。",
        ].join("\n"),
        tags: ["官方"],
        createdAt: now(),
        updatedAt: now(),
    };
}

/**
 * 官方核对：系统提示词最后一节「输出格式检查」的默认清单（历史上曾由组装器按装了几块
 * 状态栏/小剧场临时拼出来，现在与序言同规则：槽位里选了才有这一段，不选就没有，所见即所得）。
 * 按一块状态栏 + 一块小剧场的通用版写；装了多块或有机括要求的输出块，自建一件在此基础上改。
 */
export function createBuiltinChecklist(): MixTextMaterial {
    return {
        id: MIX_BUILTIN_CHECKLIST_ID,
        kind: "checklist",
        name: "官方 · 标准核对",
        hook: "出厂自带的收尾清单：正文、状态栏、小剧场逐项核对",
        author: "独家特调",
        content: [
            "每轮回复发出前逐项核对：",
            "- 正文符合「正文输出要求」。",
            "- 回复最开头已按「状态栏」的格式输出 [状态栏]...[/状态栏] 块——任何一轮都不能缺。",
            "- 回复最末尾已按「小剧场」的格式输出 [小剧场]...[/小剧场] 块——任何一轮都不能缺。",
        ].join("\n"),
        tags: ["官方"],
        createdAt: now(),
        updatedAt: now(),
    };
}

export const MIX_BUILTIN_READER_ID = "mix_builtin_reader";

/**
 * 官方机括「朗读」：对白按钮（代码登记）+ 连接器 + 无界面运行的样板。
 * 每句「对白」后面一颗喇叭，点了才把这句交给玩家的 tts 连接器合成，不点不花钱；
 * 合成结果递给宿主播放（mix.play），按钮状态由宿主画；出错用 mix.toast 说一句。
 * 不画任何面板。需要玩家在酒柜「连接器」里用「MiniMax 语音」预设建一个叫 tts 的连接器。
 */
export function createBuiltinReader(): MixMechanismMaterial {
    return {
        id: MIX_BUILTIN_READER_ID,
        kind: "mechanism",
        name: "官方 · 朗读",
        hook: "每句对白后一颗喇叭，点一下用你的 MiniMax 连接器念出来",
        author: "独家特调",
        tags: ["官方", "语音", "连接器"],
        connectors: ["tts"],
        layout: { x: 0, y: 0, w: 100, h: 10, slot: "hidden" },
        panelHtml: [
            "<script>",
            "(function(){",
            "  // 对白按钮由代码登记：每句对白后一颗喇叭",
            "  window.mix.dialogueButton({ icon: 'speaker', title: '朗读这句' });",
            "  var playingId='', cache={}, cacheKeys=[];",
            "  function hexToBytes(hex){",
            "    var n=hex.length>>1, bytes=new Uint8Array(n);",
            "    for(var i=0;i<n;i++) bytes[i]=parseInt(hex.substr(i*2,2),16);",
            "    return bytes;",
            "  }",
            "  function remember(text,bytes){ cache[text]=bytes; cacheKeys.push(text); if(cacheKeys.length>30) delete cache[cacheKeys.shift()]; }",
            "  function play(id,bytes){ playingId=id; window.mix.play(id, bytes, 'audio/mpeg'); }",
            "  window.onMixDialogue=function(e){",
            "    var id=e.id, text=String(e.text||'').trim();",
            "    if(!text) return;",
            "    if(playingId===id){ playingId=''; window.mix.stop(); window.mix.mark(id,''); return; }",
            "    if(cache[text]){ play(id,cache[text]); return; }",
            "    window.mix.mark(id,'busy');",
            "    window.mix.call('tts',{ text:text.slice(0,2000) }).then(function(r){",
            "      var d=r.data||{}; var hex=d.data&&d.data.audio;",
            "      if(!hex){ var m=(d.base_resp&&d.base_resp.status_msg)||('接口返回 '+r.status); window.mix.mark(id,''); window.mix.toast('合成失败：'+m); return; }",
            "      var bytes=hexToBytes(hex); remember(text,bytes); play(id,bytes);",
            "    }).catch(function(err){ window.mix.mark(id,''); window.mix.toast(err.missing?'先到酒柜「连接器」里建一个叫 tts 的连接器':('朗读失败：'+err.message)); });",
            "  };",
            "})();",
            "</script>",
        ].join("\n"),
        createdAt: now(),
        updatedAt: now(),
    };
}

/**
 * 官方机括「语音控制台」：独立面板 + API地址配置 + Key + 音色列表选择 + 试听 + 对白小喇叭朗读。
 */
export function createBuiltinVoiceConsole(): MixMechanismMaterial {
    return {
        id: MIX_BUILTIN_VOICE_CONSOLE_ID,
        kind: "mechanism",
        name: "官方 · 语音控制台",
        hook: "带独立控制面板的语音朗读机括：可自由配置地址、Key与音色列表，选哪个就用哪个",
        author: "独家特调",
        tags: ["官方", "语音", "机括", "面板", "朗读"],
        layout: {
            x: 6,
            y: 15,
            w: 88,
            h: 58,
            drag: true,
            resize: true,
            chrome: "bar",
            plate: true,
            collapsed: false
        },
        panelHtml: "<!DOCTYPE html>\n<html>\n<head>\n<meta charset=\"utf-8\"/>\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"/>\n<style>\n  * { box-sizing: border-box; margin: 0; padding: 0; }\n  body {\n    font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"PingFang SC\", \"Microsoft YaHei\", sans-serif;\n    color: #f1f5f9;\n    padding: 10px;\n    font-size: 13px;\n    line-height: 1.5;\n    user-select: none;\n    background: transparent;\n  }\n  .console-app {\n    display: flex;\n    flex-direction: column;\n    gap: 10px;\n    height: 100%;\n  }\n  .header-bar {\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    padding-bottom: 6px;\n    border-bottom: 1px solid rgba(255, 255, 255, 0.1);\n  }\n  .header-title {\n    font-size: 13px;\n    font-weight: 700;\n    color: #e2e8f0;\n    display: flex;\n    align-items: center;\n    gap: 6px;\n  }\n  .status-badge {\n    background: rgba(16, 185, 129, 0.2);\n    color: #34d399;\n    border: 1px solid rgba(16, 185, 129, 0.35);\n    font-size: 11px;\n    padding: 1px 7px;\n    border-radius: 999px;\n  }\n  .form-group {\n    display: flex;\n    flex-direction: column;\n    gap: 4px;\n  }\n  .form-label {\n    font-size: 11px;\n    font-weight: 600;\n    color: #94a3b8;\n  }\n  .input-box {\n    width: 100%;\n    background: rgba(15, 23, 42, 0.7);\n    border: 1px solid rgba(255, 255, 255, 0.15);\n    color: #f8fafc;\n    border-radius: 6px;\n    padding: 6px 10px;\n    font-size: 12px;\n    outline: none;\n    transition: border 0.2s;\n  }\n  .input-box:focus {\n    border-color: #38bdf8;\n  }\n  .btn-row {\n    display: flex;\n    gap: 6px;\n  }\n  .btn {\n    flex: 1;\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    gap: 4px;\n    padding: 6px 10px;\n    border-radius: 6px;\n    font-size: 12px;\n    font-weight: 500;\n    cursor: pointer;\n    border: none;\n    transition: all 0.15s;\n    white-space: nowrap;\n  }\n  .btn-primary {\n    background: #0284c7;\n    color: #fff;\n  }\n  .btn-primary:hover {\n    background: #0369a1;\n  }\n  .btn-success {\n    background: #059669;\n    color: #fff;\n  }\n  .btn-success:hover {\n    background: #047857;\n  }\n  .btn-secondary {\n    background: rgba(255, 255, 255, 0.12);\n    color: #cbd5e1;\n  }\n  .btn-secondary:hover {\n    background: rgba(255, 255, 255, 0.2);\n  }\n  .btn:active {\n    transform: scale(0.98);\n  }\n  .btn:disabled {\n    opacity: 0.5;\n    cursor: not-allowed;\n  }\n  .select-box {\n    width: 100%;\n    background: #1e293b;\n    border: 1px solid rgba(255, 255, 255, 0.2);\n    color: #f8fafc;\n    border-radius: 6px;\n    padding: 6px 8px;\n    font-size: 12px;\n    outline: none;\n    cursor: pointer;\n  }\n  .tip-text {\n    font-size: 11px;\n    color: #64748b;\n    line-height: 1.4;\n  }\n</style>\n</head>\n<body>\n<div class=\"console-app\">\n  <div class=\"header-bar\">\n    <div class=\"header-title\">\n      <span>🎙️ 专属特调 · 语音控制台</span>\n    </div>\n    <span class=\"status-badge\" id=\"statusBadge\">已就绪</span>\n  </div>\n\n  <div class=\"form-group\">\n    <label class=\"form-label\">TTS 接口地址 (Base URL)</label>\n    <input type=\"text\" class=\"input-box\" id=\"apiUrl\" placeholder=\"http://192.168.31.188:8190/v1\" />\n  </div>\n\n  <div class=\"form-group\">\n    <label class=\"form-label\">API Key (本地服务留空即可)</label>\n    <input type=\"password\" class=\"input-box\" id=\"apiKey\" placeholder=\"本地直连免填 / 云端输入 sk-...\" />\n  </div>\n\n  <div class=\"form-group\">\n    <div style=\"display:flex; justify-content:space-between; align-items:center;\">\n      <label class=\"form-label\">当前选定发音音色</label>\n      <span style=\"font-size:10px; color:#38bdf8;\" id=\"voiceCountTip\">0 个音色</span>\n    </div>\n    <select class=\"select-box\" id=\"voiceSelect\">\n      <option value=\"复件 最终版\">🌟 复件 最终版 (克隆音色 - 默认)</option>\n      <option value=\"晓晓\">晓晓 (温柔知性女声)</option>\n      <option value=\"云希\">云希 (开朗活泼男声)</option>\n      <option value=\"alloy\">alloy (OpenAI标准)</option>\n    </select>\n  </div>\n\n  <div class=\"btn-row\">\n    <button class=\"btn btn-primary\" id=\"btnSyncVoices\">🔄 同步控制台音色</button>\n    <button class=\"btn btn-success\" id=\"btnPreview\">▶️ 试听当前音色</button>\n  </div>\n\n  <div class=\"tip-text\">\n    💡 说明：选定音色后自动生效；点击对白后的小喇叭图标即可用选中的音色念出台词。\n  </div>\n</div>\n\n<script>\n(function(){\n  var DEFAULT_URL = \"http://192.168.31.188:8190/v1\";\n  var DEFAULT_VOICE = \"复件 最终版\";\n  var playingId = \"\";\n  var cache = {}, cacheKeys = [];\n\n  var elUrl = document.getElementById(\"apiUrl\");\n  var elKey = document.getElementById(\"apiKey\");\n  var elSelect = document.getElementById(\"voiceSelect\");\n  var elBadge = document.getElementById(\"statusBadge\");\n  var elCount = document.getElementById(\"voiceCountTip\");\n  var btnSync = document.getElementById(\"btnSyncVoices\");\n  var btnPreview = document.getElementById(\"btnPreview\");\n\n  // 注册对白按钮：每句对白后一颗喇叭\n  if (window.mix && typeof window.mix.dialogueButton === \"function\") {\n    window.mix.dialogueButton({ icon: \"speaker\", title: \"朗读这句\" });\n  }\n\n  function getStore() {\n    return window.MIX_STORE || {};\n  }\n\n  function saveStore(data) {\n    var store = Object.assign(getStore(), data);\n    window.MIX_STORE = store;\n    if (window.mix && typeof window.mix.setStore === \"function\") {\n      window.mix.setStore(store);\n    }\n  }\n\n  function setStatus(text, color) {\n    if (!elBadge) return;\n    elBadge.textContent = text;\n    if (color) {\n      elBadge.style.color = color;\n      elBadge.style.borderColor = color;\n    }\n  }\n\n  function initUI() {\n    var s = getStore();\n    elUrl.value = s.voiceApiUrl || DEFAULT_URL;\n    elKey.value = s.voiceApiKey || \"\";\n    \n    var voices = s.voiceList || [];\n    if (Array.isArray(voices) && voices.length > 0) {\n      renderVoices(voices, s.selectedVoice || DEFAULT_VOICE);\n    } else {\n      syncVoices(false);\n    }\n  }\n\n  function renderVoices(voices, selected) {\n    elSelect.innerHTML = \"\";\n    voices.forEach(function(v) {\n      var opt = document.createElement(\"option\");\n      opt.value = v.id;\n      opt.textContent = v.name || v.id;\n      if (v.id === selected) opt.selected = true;\n      elSelect.appendChild(opt);\n    });\n    elCount.textContent = voices.length + \" 个音色\";\n    if (selected && !elSelect.value) {\n      elSelect.value = selected;\n    }\n  }\n\n  async function syncVoices(showToast) {\n    var url = (elUrl.value || DEFAULT_URL).replace(/\\/+$/, \"\");\n    setStatus(\"同步中...\", \"#38bdf8\");\n    btnSync.disabled = true;\n\n    try {\n      var headers = {};\n      if (elKey.value.trim()) headers[\"Authorization\"] = \"Bearer \" + elKey.value.trim();\n\n      var resp = await fetch(url + \"/audio/voices\", { headers: headers });\n      var data = await resp.json();\n      var list = data.voices || data.data || [];\n\n      if (list && list.length > 0) {\n        var currentSel = elSelect.value || getStore().selectedVoice || DEFAULT_VOICE;\n        renderVoices(list, currentSel);\n        saveStore({\n          voiceApiUrl: elUrl.value,\n          voiceApiKey: elKey.value,\n          voiceList: list,\n          selectedVoice: elSelect.value\n        });\n        setStatus(\"就绪\", \"#34d399\");\n        if (showToast && window.mix && window.mix.toast) {\n          window.mix.toast(\"✅ 成功获取 \" + list.length + \" 个音色！\");\n        }\n      } else {\n        throw new Error(\"返回音色列表为空\");\n      }\n    } catch(err) {\n      setStatus(\"连接失败\", \"#f87171\");\n      if (showToast && window.mix && window.mix.toast) {\n        window.mix.toast(\"同步失败：\" + err.message);\n      }\n    } finally {\n      btnSync.disabled = false;\n    }\n  }\n\n  async function synthAudio(text, voice) {\n    var url = (elUrl.value || DEFAULT_URL).replace(/\\/+$/, \"\");\n    var reqUrl = url + (url.endsWith(\"/v1\") ? \"/audio/speech\" : \"/v1/audio/speech\");\n    if (url.endsWith(\"/audio/speech\")) reqUrl = url;\n\n    var headers = { \"Content-Type\": \"application/json\" };\n    if (elKey.value.trim()) headers[\"Authorization\"] = \"Bearer \" + elKey.value.trim();\n    else headers[\"Authorization\"] = \"Bearer sk-local-none\";\n\n    var payload = {\n      model: \"tts-1\",\n      input: text,\n      voice: voice || elSelect.value || DEFAULT_VOICE,\n      response_format: \"mp3\"\n    };\n\n    var resp = await fetch(reqUrl, {\n      method: \"POST\",\n      headers: headers,\n      body: JSON.stringify(payload)\n    });\n\n    if (!resp.ok) {\n      var errTxt = await resp.text().catch(function(){ return \"\"; });\n      throw new Error(\"HTTP \" + resp.status + \": \" + errTxt.slice(0, 100));\n    }\n\n    var buf = await resp.arrayBuffer();\n    return new Uint8Array(buf);\n  }\n\n  function playAudio(id, bytes) {\n    playingId = id;\n    if (window.mix && typeof window.mix.play === \"function\") {\n      window.mix.play(id, bytes, \"audio/mpeg\");\n    } else {\n      var blob = new Blob([bytes], { type: \"audio/mpeg\" });\n      var a = new Audio(URL.createObjectURL(blob));\n      a.play();\n    }\n  }\n\n  // 试听当前选定音色\n  btnPreview.addEventListener(\"click\", async function() {\n    var voice = elSelect.value;\n    var previewText = \"你好，当前专属音色设置成功，朗读功能一切正常！\";\n    setStatus(\"合成中...\", \"#38bdf8\");\n    btnPreview.disabled = true;\n\n    try {\n      var bytes = await synthAudio(previewText, voice);\n      setStatus(\"播放中...\", \"#a855f7\");\n      playAudio(\"preview_\" + Date.now(), bytes);\n      setTimeout(function(){ setStatus(\"就绪\", \"#34d399\"); }, 3000);\n      if (window.mix && window.mix.toast) window.mix.toast(\"正在试听【\" + voice + \"】\");\n    } catch(e) {\n      setStatus(\"失败\", \"#f87171\");\n      if (window.mix && window.mix.toast) window.mix.toast(\"试听失败：\" + e.message);\n    } finally {\n      btnPreview.disabled = false;\n    }\n  });\n\n  elUrl.addEventListener(\"change\", function(){ saveStore({ voiceApiUrl: elUrl.value }); });\n  elKey.addEventListener(\"change\", function(){ saveStore({ voiceApiKey: elKey.value }); });\n  elSelect.addEventListener(\"change\", function(){\n    saveStore({ selectedVoice: elSelect.value });\n    if (window.mix && window.mix.toast) window.mix.toast(\"已选择音色【\" + elSelect.value + \"】\");\n  });\n\n  btnSync.addEventListener(\"click\", function(){ syncVoices(true); });\n\n  window.onMixDialogue = async function(e) {\n    var id = e.id;\n    var text = String(e.text || \"\").trim();\n    if (!text) return;\n\n    if (playingId === id) {\n      playingId = \"\";\n      if (window.mix) {\n        if (window.mix.stop) window.mix.stop();\n        if (window.mix.mark) window.mix.mark(id, \"\");\n      }\n      return;\n    }\n\n    var selectedVoice = elSelect.value || DEFAULT_VOICE;\n    var cacheKey = selectedVoice + \"::\" + text;\n\n    if (cache[cacheKey]) {\n      if (window.mix && window.mix.mark) window.mix.mark(id, \"playing\");\n      playAudio(id, cache[cacheKey]);\n      return;\n    }\n\n    if (window.mix && window.mix.mark) window.mix.mark(id, \"busy\");\n    setStatus(\"正在合成...\", \"#38bdf8\");\n\n    try {\n      var bytes = await synthAudio(text, selectedVoice);\n      cache[cacheKey] = bytes;\n      cacheKeys.push(cacheKey);\n      if (cacheKeys.length > 30) delete cache[cacheKeys.shift()];\n\n      if (window.mix && window.mix.mark) window.mix.mark(id, \"playing\");\n      setStatus(\"朗读中...\", \"#a855f7\");\n      playAudio(id, bytes);\n      setTimeout(function(){ setStatus(\"就绪\", \"#34d399\"); }, 4000);\n    } catch(err) {\n      if (window.mix) {\n        if (window.mix.mark) window.mix.mark(id, \"\");\n        if (window.mix.toast) window.mix.toast(\"朗读失败：\" + err.message);\n      }\n      setStatus(\"朗读失败\", \"#f87171\");\n    }\n  };\n\n  window.onMixSync = function(state, store) {\n    window.MIX_STORE = store || {};\n    initUI();\n  };\n\n  initUI();\n})();\n</script>\n</body>\n</html>\n",
        createdAt: now(),
        updatedAt: now(),
    };
}
