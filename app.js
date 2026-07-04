const SUPABASE_URL = "https://gftydfeqpuavajjzaeun.supabase.co";
const SUPABASE_KEY = "sb_publishable_35lefXRrUU4MFrAATfghjQ_2EPkUgGy";
const IMAGE_BUCKET = "post-images";
const LAYOUT_KEY = "lab-feed-layout-v1";

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const stage = document.querySelector("#stage");
const template = document.querySelector("#postTemplate");
const photoInput = document.querySelector("#photoInput");
const previewImage = document.querySelector("#previewImage");
const dropzone = document.querySelector(".dropzone");
const messageInput = document.querySelector("#messageInput");
const saveButton = document.querySelector("#saveButton");
const statusText = document.querySelector("#statusText");
const shuffleButton = document.querySelector("#shuffleButton");

let selectedFile = null;
let posts = [];
let layout = readLayout();

function readLayout() {
  try {
    return JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeLayout() {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
}

function setStatus(text) {
  statusText.textContent = text;
}

function publicImageUrl(path) {
  if (!path) return "";
  return client.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ko", { month: "short", day: "numeric" }).format(new Date(value));
}

function fallbackGradient(seed) {
  const hues = [78, 196, 330, 24, 252];
  const a = hues[seed % hues.length];
  const b = hues[(seed + 2) % hues.length];
  return `linear-gradient(135deg, hsl(${a} 92% 67%), hsl(${b} 92% 66%))`;
}

function renderPosts({ freshId } = {}) {
  stage.innerHTML = "";

  if (!posts.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "아직 조용함";
    stage.appendChild(empty);
    return;
  }

  posts.forEach((post, index) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const img = node.querySelector(".post-image");
    const media = node.querySelector(".media-wrap");
    const message = node.querySelector(".post-message");
    const date = node.querySelector(".post-date");
    const saved = layout[post.id] || {};

    node.dataset.id = post.id;
    node.style.setProperty("--tx", `${saved.x || 0}px`);
    node.style.setProperty("--ty", `${saved.y || 0}px`);
    node.style.setProperty("--rot", `${saved.rot ?? rotationFor(index)}deg`);
    if (post.id === freshId) node.classList.add("is-new");

    message.textContent = post.message || "untitled";
    date.textContent = post.created_at ? formatDate(post.created_at) : "now";

    const src = publicImageUrl(post.image_path);
    if (src) {
      img.src = src;
      img.alt = post.message || "post image";
    } else {
      img.remove();
      media.style.background = fallbackGradient(index);
    }

    attachDrag(node);
    stage.appendChild(node);
  });
}

function rotationFor(index) {
  return [-1.4, 1.8, -2.2, 1.1, -0.7][index % 5];
}

async function loadPosts() {
  setStatus("sync");
  const { data, error } = await client
    .from("posts")
    .select("id,message,image_path,created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    setStatus(error.message);
    posts = demoPosts();
  } else {
    posts = data || [];
    setStatus("");
  }

  renderPosts();
}

function demoPosts() {
  return [
    { id: "demo-a", message: "soft launch", created_at: new Date().toISOString(), image_path: "" },
    { id: "demo-b", message: "move me", created_at: new Date().toISOString(), image_path: "" },
  ];
}

photoInput.addEventListener("change", () => {
  selectedFile = photoInput.files?.[0] || null;
  if (!selectedFile) return;

  previewImage.src = URL.createObjectURL(selectedFile);
  dropzone.classList.add("has-image");
});

saveButton.addEventListener("click", async () => {
  const message = messageInput.value.trim();
  if (!message && !selectedFile) {
    setStatus("비어 있음");
    return;
  }

  saveButton.disabled = true;
  setStatus("posting");

  try {
    const imagePath = selectedFile ? await uploadImage(selectedFile) : "";
    const { data, error } = await client
      .from("posts")
      .insert({ message: message || "photo drop", image_path: imagePath })
      .select("id,message,image_path,created_at")
      .single();

    if (error) throw error;

    posts = [data, ...posts];
    messageInput.value = "";
    photoInput.value = "";
    selectedFile = null;
    previewImage.removeAttribute("src");
    dropzone.classList.remove("has-image");
    setStatus("saved");
    renderPosts({ freshId: data.id });
    window.setTimeout(() => setStatus(""), 1200);
  } catch (error) {
    setStatus(error.message || "save failed");
  } finally {
    saveButton.disabled = false;
  }
});

async function uploadImage(file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const day = new Date().toISOString().slice(0, 10);
  const path = `${day}/${crypto.randomUUID()}.${ext}`;
  const { error } = await client.storage.from(IMAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || "image/jpeg",
    upsert: false,
  });

  if (error) throw error;
  return path;
}

function attachDrag(card) {
  let startX = 0;
  let startY = 0;
  let baseX = 0;
  let baseY = 0;
  let isDragging = false;

  card.addEventListener("pointerdown", (event) => {
    card.setPointerCapture(event.pointerId);
    const saved = layout[card.dataset.id] || {};
    startX = event.clientX;
    startY = event.clientY;
    baseX = saved.x || 0;
    baseY = saved.y || 0;
    isDragging = true;
    card.classList.add("is-dragging");
  });

  card.addEventListener("pointermove", (event) => {
    if (!isDragging) return;
    const x = baseX + event.clientX - startX;
    const y = baseY + event.clientY - startY;
    const rot = Math.max(-7, Math.min(7, x / 24));
    card.style.setProperty("--tx", `${x}px`);
    card.style.setProperty("--ty", `${y}px`);
    card.style.setProperty("--rot", `${rot}deg`);
  });

  card.addEventListener("pointerup", (event) => finishDrag(card, event.pointerId));
  card.addEventListener("pointercancel", (event) => finishDrag(card, event.pointerId));
}

function finishDrag(card, pointerId) {
  const matrix = new DOMMatrixReadOnly(getComputedStyle(card).transform);
  const x = Math.round(matrix.m41);
  const y = Math.round(matrix.m42);
  const rot = Number.parseFloat(getComputedStyle(card).getPropertyValue("--rot")) || 0;

  card.releasePointerCapture(pointerId);
  card.classList.remove("is-dragging");
  layout[card.dataset.id] = { x, y, rot };
  writeLayout();
}

shuffleButton.addEventListener("click", () => {
  const cards = [...stage.querySelectorAll(".post-card")];
  cards.forEach((card, index) => {
    const x = Math.round((Math.random() - 0.5) * 54);
    const y = Math.round((Math.random() - 0.5) * 42);
    const rot = rotationFor(index) + (Math.random() - 0.5) * 4;
    layout[card.dataset.id] = { x, y, rot };
    card.style.setProperty("--tx", `${x}px`);
    card.style.setProperty("--ty", `${y}px`);
    card.style.setProperty("--rot", `${rot}deg`);
  });
  writeLayout();
});

loadPosts();
