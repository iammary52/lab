const SUPABASE_URL = "https://gftydfeqpuavajjzaeun.supabase.co";
const SUPABASE_KEY = "sb_publishable_35lefXRrUU4MFrAATfghjQ_2EPkUgGy";
const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
const IMAGE_BUCKET = "post-images";
const LIKED_KEY = "lab-feed-liked-session-v1";

let client;
const stage = document.querySelector("#stage");
const postTemplate = document.querySelector("#postTemplate");
const commentTemplate = document.querySelector("#commentTemplate");
const photoInput = document.querySelector("#photoInput");
const previewImage = document.querySelector("#previewImage");
const dropzone = document.querySelector(".dropzone");
const messageInput = document.querySelector("#messageInput");
const saveButton = document.querySelector("#saveButton");
const statusText = document.querySelector("#statusText");
const refreshButton = document.querySelector("#refreshButton");
const searchInput = document.querySelector("#searchInput");
const sortButtons = [...document.querySelectorAll(".sort-chip")];

let selectedFile = null;
let currentSort = "new";
let posts = [];
let likedPosts = readLiked();

function loadSupabaseSdk() {
  if (window.supabase?.createClient) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SUPABASE_CDN;
    script.async = true;
    script.onload = () => (window.supabase?.createClient ? resolve() : reject(new Error("Supabase SDK unavailable")));
    script.onerror = () => reject(new Error("Supabase SDK failed to load"));
    document.head.appendChild(script);
  });
}

function readLiked() {
  try {
    return JSON.parse(sessionStorage.getItem(LIKED_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeLiked() {
  sessionStorage.setItem(LIKED_KEY, JSON.stringify(likedPosts));
}

function setStatus(text) {
  statusText.textContent = text;
}

function publicImageUrl(path) {
  if (!path) return "";
  return client.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function fallbackGradient(seed) {
  const pairs = [
    ["#d7ff2f", "#30d8ff"],
    ["#ff4fb8", "#ff8a2a"],
    ["#5468ff", "#d7ff2f"],
    ["#30d8ff", "#ff4fb8"],
  ];
  const [a, b] = pairs[seed % pairs.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

function visiblePosts() {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = q
    ? posts.filter((post) => `${post.message || ""}`.toLowerCase().includes(q))
    : [...posts];

  if (currentSort === "hot") {
    filtered.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
  }

  return filtered;
}

function renderPosts({ freshId } = {}) {
  const visible = visiblePosts();
  stage.innerHTML = "";

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = searchInput.value ? "no matching drops" : "feed is empty";
    stage.appendChild(empty);
    return;
  }

  visible.forEach((post, index) => {
    const node = postTemplate.content.firstElementChild.cloneNode(true);
    const img = node.querySelector(".post-image");
    const media = node.querySelector(".media-wrap");
    const message = node.querySelector(".post-message");
    const date = node.querySelector(".post-date");
    const heart = node.querySelector(".heart-button");
    const likeCount = node.querySelector(".like-count");
    const commentCount = node.querySelector(".comment-count");
    const comments = node.querySelector(".comments");
    const commentForm = node.querySelector(".comment-form");
    const commentInput = node.querySelector(".comment-input");

    if (post.id === freshId) node.classList.add("is-new");
    message.textContent = post.message || "untitled";
    date.textContent = post.created_at ? formatDate(post.created_at) : "now";
    likeCount.textContent = post.likes_count || 0;

    const postComments = post.comments || [];
    commentCount.textContent = `${postComments.length} comment${postComments.length === 1 ? "" : "s"}`;
    renderComments(comments, postComments);

    if (likedPosts[post.id]) {
      heart.textContent = "♥";
      heart.classList.add("is-liked");
      heart.disabled = true;
    }

    const src = publicImageUrl(post.image_path);
    if (src) {
      img.src = src;
      img.alt = post.message || "post image";
    } else {
      img.remove();
      media.style.background = fallbackGradient(index);
    }

    heart.addEventListener("click", () => likePost(post.id, heart, likeCount));
    node.querySelector(".edit-post").addEventListener("click", () => editPost(post));
    node.querySelector(".delete-post").addEventListener("click", () => deletePost(post));
    commentForm.addEventListener("submit", (event) => {
      event.preventDefault();
      addComment(post.id, commentInput);
    });

    stage.appendChild(node);
  });
}

function renderComments(container, comments) {
  container.innerHTML = "";
  comments
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .forEach((comment) => {
      const node = commentTemplate.content.firstElementChild.cloneNode(true);
      node.querySelector(".comment-message").textContent = comment.message;
      node.querySelector(".comment-date").textContent = formatDate(comment.created_at);
      node.querySelector(".edit-comment").addEventListener("click", () => editComment(comment));
      node.querySelector(".delete-comment").addEventListener("click", () => deleteComment(comment));
      container.appendChild(node);
    });
}

async function loadPosts() {
  setStatus("syncing");
  const { data, error } = await client
    .from("posts")
    .select("id,message,image_path,created_at,updated_at,likes_count,comments(id,post_id,message,created_at,updated_at)")
    .order("created_at", { ascending: false })
    .limit(40);

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
    { id: "demo-a", message: "soft launch", likes_count: 0, comments: [], created_at: new Date().toISOString(), image_path: "" },
    { id: "demo-b", message: "comments are open", likes_count: 2, comments: [], created_at: new Date().toISOString(), image_path: "" },
  ];
}

photoInput.addEventListener("change", () => {
  selectedFile = photoInput.files?.[0] || null;
  if (!selectedFile) return;

  previewImage.src = URL.createObjectURL(selectedFile);
  dropzone.classList.add("has-image");
});

sortButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentSort = button.dataset.sort;
    sortButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    renderPosts();
  });
});

searchInput.addEventListener("input", () => renderPosts());
refreshButton.addEventListener("click", () => loadPosts());

saveButton.addEventListener("click", async () => {
  const message = messageInput.value.trim();
  if (!message && !selectedFile) {
    setStatus("empty drop");
    return;
  }

  saveButton.disabled = true;
  setStatus("posting");

  try {
    const imagePath = selectedFile ? await uploadImage(selectedFile) : "";
    const { data, error } = await client
      .from("posts")
      .insert({ message: message || "photo drop", image_path: imagePath })
      .select("id,message,image_path,created_at,updated_at,likes_count,comments(id,post_id,message,created_at,updated_at)")
      .single();

    if (error) throw error;

    posts = [{ ...data, comments: data.comments || [] }, ...posts];
    messageInput.value = "";
    photoInput.value = "";
    selectedFile = null;
    previewImage.removeAttribute("src");
    dropzone.classList.remove("has-image");
    setStatus("posted");
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

async function likePost(postId, heart, likeCount) {
  if (likedPosts[postId]) return;

  heart.disabled = true;
  const { data, error } = await client.rpc("increment_post_like", { target_post_id: postId });
  if (error) {
    setStatus(error.message);
    heart.disabled = false;
    return;
  }

  likedPosts[postId] = true;
  writeLiked();
  const post = posts.find((item) => item.id === postId);
  if (post) post.likes_count = data;
  heart.textContent = "♥";
  heart.classList.add("is-liked");
  likeCount.textContent = data;
}

async function editPost(post) {
  const next = window.prompt("Edit post", post.message || "");
  if (next === null) return;
  const message = next.trim();
  if (!message) return;

  const { data, error } = await client
    .from("posts")
    .update({ message, updated_at: new Date().toISOString() })
    .eq("id", post.id)
    .select("id,message,image_path,created_at,updated_at,likes_count,comments(id,post_id,message,created_at,updated_at)")
    .single();

  if (error) {
    setStatus(error.message);
    return;
  }

  posts = posts.map((item) => (item.id === post.id ? { ...data, comments: data.comments || [] } : item));
  renderPosts();
}

async function deletePost(post) {
  if (!window.confirm("Delete this post?")) return;
  const { error } = await client.from("posts").delete().eq("id", post.id);
  if (error) {
    setStatus(error.message);
    return;
  }
  posts = posts.filter((item) => item.id !== post.id);
  renderPosts();
}

async function addComment(postId, input) {
  const message = input.value.trim();
  if (!message) return;
  input.value = "";

  const { data, error } = await client
    .from("comments")
    .insert({ post_id: postId, message })
    .select("id,post_id,message,created_at,updated_at")
    .single();

  if (error) {
    setStatus(error.message);
    input.value = message;
    return;
  }

  const post = posts.find((item) => item.id === postId);
  if (post) post.comments = [...(post.comments || []), data];
  renderPosts();
}

async function editComment(comment) {
  const next = window.prompt("Edit comment", comment.message || "");
  if (next === null) return;
  const message = next.trim();
  if (!message) return;

  const { data, error } = await client
    .from("comments")
    .update({ message, updated_at: new Date().toISOString() })
    .eq("id", comment.id)
    .select("id,post_id,message,created_at,updated_at")
    .single();

  if (error) {
    setStatus(error.message);
    return;
  }

  const post = posts.find((item) => item.id === data.post_id);
  if (post) {
    post.comments = (post.comments || []).map((item) => (item.id === data.id ? data : item));
  }
  renderPosts();
}

async function deleteComment(comment) {
  if (!window.confirm("Delete this comment?")) return;
  const { error } = await client.from("comments").delete().eq("id", comment.id);
  if (error) {
    setStatus(error.message);
    return;
  }

  const post = posts.find((item) => item.id === comment.post_id);
  if (post) post.comments = (post.comments || []).filter((item) => item.id !== comment.id);
  renderPosts();
}

loadSupabaseSdk()
  .then(() => {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return loadPosts();
  })
  .catch((error) => setStatus(error.message));
