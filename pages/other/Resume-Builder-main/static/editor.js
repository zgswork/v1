const state = {
  currentTemplate: "classic",
  resumeData: {},
  templates: [],
  refreshTimer: null,
};

const SECTION_ORDER = [
  "profile",
  "workExperiences",
  "educations",
  "projects",
  "skills",
  "selfEvaluation",
];

const SECTION_CONFIG = {
  profile: {
    title: "个人信息",
    type: "object",
    fields: [
      { key: "name", label: "姓名" },
      { key: "title", label: "求职意向" },
      { key: "email", label: "邮箱" },
      { key: "phone", label: "电话" },
      { key: "location", label: "所在地" },
      { key: "age", label: "年龄" },
      { key: "gender", label: "性别" },
      { key: "desiredSalary", label: "期望薪资" },
      { key: "availableDate", label: "到岗时间" },
      { key: "summary", label: "个人简介", multiline: true },
    ],
  },
  workExperiences: {
    title: "工作经历",
    type: "array",
    fields: [
      { key: "company", label: "公司" },
      { key: "jobTitle", label: "职位" },
      { key: "date", label: "时间" },
      { key: "descriptions", label: "职责描述", multiline: true, isList: true },
    ],
  },
  educations: {
    title: "教育经历",
    type: "array",
    fields: [
      { key: "school", label: "学校" },
      { key: "degree", label: "学历" },
      { key: "date", label: "时间" },
      { key: "descriptions", label: "备注", multiline: true, isList: true },
    ],
  },
  projects: {
    title: "项目经历",
    type: "array",
    fields: [
      { key: "project", label: "项目名称" },
      { key: "date", label: "时间" },
      { key: "descriptions", label: "项目描述", multiline: true, isList: true },
    ],
  },
  skills: {
    title: "技能",
    type: "special",
    fields: [
      { key: "featuredSkills", label: "主要技能", isSkillsList: true },
      { key: "descriptions", label: "其他技能标签", multiline: true, isList: true },
    ],
  },
  selfEvaluation: {
    title: "自我评价",
    type: "simple",
    fields: [
      { key: "descriptions", label: "内容", multiline: true, isList: true },
    ],
  },
};

const $ = (selector, root = document) => root.querySelector(selector);

function createElement(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  const childList = Array.isArray(children) ? children : [children];

  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.type) node.type = options.type;
  if (options.value !== undefined) node.value = options.value;
  if (options.title) node.title = options.title;
  if (options.ariaLabel) node.setAttribute("aria-label", options.ariaLabel);
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, value]) => {
      if (value !== undefined && value !== null) node.setAttribute(key, value);
    });
  }
  if (options.dataset) {
    Object.entries(options.dataset).forEach(([key, value]) => {
      if (value !== undefined && value !== null) node.dataset[key] = String(value);
    });
  }

  childList.filter(Boolean).forEach((child) => node.append(child));
  return node;
}

function setStatus(message) {
  $("#editorStatus").textContent = message;
}

function fieldDef(section, field) {
  return SECTION_CONFIG[section]?.fields?.find((item) => item.key === field);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.json();
}

async function init() {
  bindEvents();
  try {
    await loadTemplates();
    await loadSample();
  } catch (error) {
    setStatus(`加载失败：${error.message}`);
    $("#editorContent").replaceChildren(createElement("div", {
      className: "empty-state",
      text: "加载失败，请检查后端服务",
    }));
  }
}

function bindEvents() {
  document.addEventListener("click", handleGlobalClick);
  $("#templateBar").addEventListener("click", handleTemplateClick);
  $("#editorContent").addEventListener("input", handleEditorInput);
  $("#editorContent").addEventListener("click", handleEditorClick);
  $("#jsonOverlay").addEventListener("click", (event) => {
    if (event.target.id === "jsonOverlay") closeJSON();
  });
}

async function handleGlobalClick(event) {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;

  if (action === "load-sample") await loadSample();
  if (action === "export-pdf") exportFile("pdf");
  if (action === "export-word") exportFile("word");
  if (action === "switch-json") switchToJSON();
  if (action === "apply-json") applyJSON();
  if (action === "close-json") closeJSON();
  if (action === "refresh-preview") refreshPreview();
}

function handleTemplateClick(event) {
  const button = event.target.closest("[data-template-id]");
  if (!button) return;
  selectTemplate(button.dataset.templateId);
}

function handleEditorInput(event) {
  const control = event.target.closest("[data-control]");
  if (!control) return;

  if (control.dataset.control === "field") updateField(control);
  if (control.dataset.control === "array-field") updateArrayField(control);
  if (control.dataset.control === "skill") updateSkill(control);

  queuePreview();
}

function handleEditorClick(event) {
  const action = event.target.closest("[data-editor-action]")?.dataset.editorAction;
  if (!action) return;

  const button = event.target.closest("[data-editor-action]");
  const section = button.dataset.section;
  const index = Number(button.dataset.index);

  if (action === "add-item") addItem(section);
  if (action === "delete-item") deleteItem(section, index);
  if (action === "move-up") moveItem(section, index, "up");
  if (action === "move-down") moveItem(section, index, "down");
  if (action === "add-skill") addSkill();
  if (action === "delete-skill") removeSkill(index);
}

async function loadTemplates() {
  state.templates = await fetchJson("/api/templates");
  renderTemplateBar();
}

function renderTemplateBar() {
  const templateBar = $("#templateBar");
  const chips = state.templates.map((template) => createElement("button", {
    className: "template-chip",
    type: "button",
    text: template.name || template.id,
    attrs: {
      "aria-pressed": template.id === state.currentTemplate ? "true" : "false",
    },
    dataset: { templateId: template.id },
  }));
  templateBar.replaceChildren(...chips);
}

function selectTemplate(id) {
  state.currentTemplate = id;
  renderTemplateBar();
  const templateName = state.templates.find((template) => template.id === id)?.name || id;
  $("#previewInfo").textContent = `模板：${templateName}`;
  refreshPreview();
}

async function loadSample() {
  state.resumeData = await fetchJson("/api/sample-data");
  state.currentTemplate = "classic";
  renderTemplateBar();
  renderForm();
  selectTemplate("classic");
  setStatus("已加载示例1");
}

function renderForm() {
  const blocks = SECTION_ORDER.map((section) => renderSection(section)).filter(Boolean);
  $("#editorContent").replaceChildren(...blocks);
}

function renderSection(section) {
  const config = SECTION_CONFIG[section];
  if (!config) return null;

  const body = createElement("div", { className: "section-body" });
  const block = createElement("section", { className: "section-block" }, [
    createElement("header", { className: "section-header" }, [
      createElement("strong", { text: config.title }),
    ]),
    body,
  ]);

  if (config.type === "object") renderObjectFields(body, section, config);
  if (config.type === "array") renderArrayFields(body, section, config);
  if (config.type === "special") renderSkillsFields(body, section);
  if (config.type === "simple") renderSimpleFields(body, section, config);

  return block;
}

function renderObjectFields(parent, section, config) {
  const data = state.resumeData[section] || {};
  config.fields.forEach((field) => {
    parent.append(renderField({
      section,
      field,
      value: data[field.key] || "",
      control: "field",
    }));
  });
}

function renderArrayFields(parent, section, config) {
  const items = state.resumeData[section] || [];
  items.forEach((item, index) => {
    parent.append(renderArrayItem(section, index, item, config, items.length > 1));
  });
  parent.append(createElement("div", { className: "add-row" }, [
    createElement("button", {
      className: "btn btn-ghost",
      type: "button",
      text: `添加${config.title}`,
      dataset: { editorAction: "add-item", section },
    }),
  ]));
}

function renderArrayItem(section, index, item, config, showDelete) {
  const toolbarChildren = [
    createElement("span", { className: "item-index", text: `#${index + 1}` }),
  ];

  if (index > 0) toolbarChildren.push(createElement("button", {
    className: "mini-button",
    type: "button",
    text: "↑",
    title: "上移",
    ariaLabel: "上移",
    dataset: { editorAction: "move-up", section, index },
  }));

  if (index < (state.resumeData[section] || []).length - 1) toolbarChildren.push(createElement("button", {
    className: "mini-button",
    type: "button",
    text: "↓",
    title: "下移",
    ariaLabel: "下移",
    dataset: { editorAction: "move-down", section, index },
  }));

  if (showDelete) toolbarChildren.push(createElement("button", {
    className: "mini-button btn-danger",
    type: "button",
    text: "删除",
    dataset: { editorAction: "delete-item", section, index },
  }));

  const card = createElement("article", { className: "item-card" }, [
    createElement("div", { className: "item-toolbar" }, toolbarChildren),
  ]);

  config.fields.forEach((field) => {
    const value = field.isList && Array.isArray(item[field.key])
      ? item[field.key].join("\n")
      : item[field.key] || "";
    card.append(renderField({
      section,
      index,
      field,
      value,
      control: "array-field",
    }));
  });

  return card;
}

function renderSkillsFields(parent) {
  const skills = state.resumeData.skills || {};
  const featuredSkills = skills.featuredSkills || [];

  const skillGroup = createElement("div", { className: "field-group" }, [
    createElement("label", { className: "field-label", text: "主要技能" }),
  ]);

  featuredSkills.forEach((skill, index) => {
    skillGroup.append(createElement("div", { className: "skill-row" }, [
      createElement("input", {
        className: "field-input",
        type: "text",
        value: skill.skill || "",
        attrs: { placeholder: "技能名称" },
        dataset: { control: "skill", index, field: "skill" },
      }),
      createElement("input", {
        className: "field-input rating-input",
        type: "number",
        value: skill.rating || 5,
        attrs: { min: "1", max: "5", "aria-label": "技能评级" },
        dataset: { control: "skill", index, field: "rating" },
      }),
      createElement("button", {
        className: "mini-button btn-danger",
        type: "button",
        text: "删除",
        dataset: { editorAction: "delete-skill", index },
      }),
    ]));
  });

  skillGroup.append(createElement("button", {
    className: "btn btn-ghost",
    type: "button",
    text: "添加技能",
    dataset: { editorAction: "add-skill" },
  }));
  parent.append(skillGroup);

  parent.append(renderField({
    section: "skills",
    field: { key: "descriptions", label: "其他技能标签", multiline: true, isList: true },
    value: (skills.descriptions || []).join("\n"),
    control: "field",
  }));
}

function renderSimpleFields(parent, section, config) {
  const data = state.resumeData[section] || {};
  config.fields.forEach((field) => {
    parent.append(renderField({
      section,
      field,
      value: Array.isArray(data[field.key]) ? data[field.key].join("\n") : data[field.key] || "",
      control: "field",
    }));
  });
}

function renderField({ section, index, field, value, control }) {
  const inputTag = field.multiline ? "textarea" : "input";
  const inputClass = field.multiline ? "field-textarea" : "field-input";
  const attrs = field.multiline ? { rows: "3" } : {};
  const input = createElement(inputTag, {
    className: inputClass,
    type: field.multiline ? undefined : "text",
    value: String(value),
    attrs,
    dataset: {
      control,
      section,
      index,
      field: field.key,
    },
  });

  return createElement("div", { className: "field-group" }, [
    createElement("label", { className: "field-label", text: field.label }),
    input,
  ]);
}

function updateField(control) {
  const { section, field } = control.dataset;
  if (!state.resumeData[section]) state.resumeData[section] = {};
  const definition = fieldDef(section, field);
  state.resumeData[section][field] = definition?.isList ? lines(control.value) : control.value;
}

function updateArrayField(control) {
  const { section, field } = control.dataset;
  const index = Number(control.dataset.index);
  const items = state.resumeData[section] || [];
  if (!items[index]) return;
  const definition = fieldDef(section, field);
  items[index][field] = definition?.isList ? lines(control.value) : control.value;
}

function updateSkill(control) {
  const index = Number(control.dataset.index);
  const field = control.dataset.field;
  const skills = state.resumeData.skills?.featuredSkills || [];
  if (!skills[index]) return;
  skills[index][field] = field === "rating" ? Number(control.value) || 0 : control.value;
}

function lines(value) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function addItem(section) {
  if (!state.resumeData[section]) state.resumeData[section] = [];
  const config = SECTION_CONFIG[section];
  const newItem = {};
  config.fields.forEach((field) => {
    newItem[field.key] = field.isList ? [] : "";
  });
  state.resumeData[section].push(newItem);
  renderForm();
  queuePreview();
}

function deleteItem(section, index) {
  state.resumeData[section].splice(index, 1);
  renderForm();
  queuePreview();
}

function moveItem(section, index, direction) {
  const items = state.resumeData[section];
  if (direction === "up" && index > 0) {
    [items[index - 1], items[index]] = [items[index], items[index - 1]];
  }
  if (direction === "down" && index < items.length - 1) {
    [items[index + 1], items[index]] = [items[index], items[index + 1]];
  }
  renderForm();
  queuePreview();
}

function addSkill() {
  if (!state.resumeData.skills) state.resumeData.skills = {};
  if (!state.resumeData.skills.featuredSkills) state.resumeData.skills.featuredSkills = [];
  state.resumeData.skills.featuredSkills.push({ skill: "", rating: 5 });
  renderForm();
  queuePreview();
}

function removeSkill(index) {
  state.resumeData.skills.featuredSkills.splice(index, 1);
  renderForm();
  queuePreview();
}

function switchToJSON() {
  $("#jsonText").value = JSON.stringify(state.resumeData, null, 2);
  $("#jsonOverlay").hidden = false;
  $("#jsonText").focus();
}

function closeJSON() {
  $("#jsonOverlay").hidden = true;
}

function applyJSON() {
  try {
    state.resumeData = JSON.parse($("#jsonText").value);
    renderForm();
    refreshPreview();
    closeJSON();
    setStatus("JSON 已应用");
  } catch (error) {
    setStatus(`JSON 格式错误：${error.message}`);
  }
}

function queuePreview() {
  clearTimeout(state.refreshTimer);
  setStatus("预览待更新");
  state.refreshTimer = setTimeout(refreshPreview, 320);
}

function refreshPreview() {
  clearTimeout(state.refreshTimer);
  const dataStr = encodeURIComponent(JSON.stringify(state.resumeData));
  $("#previewFrame").src = `/api/preview/${state.currentTemplate}?data=${dataStr}`;
  setStatus("预览已更新");
}

function exportFile(type) {
  const dataStr = encodeURIComponent(JSON.stringify(state.resumeData));
  window.open(`/api/export-${type}/${state.currentTemplate}?data=${dataStr}`, "_blank");
}

init();
