import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://nginx";
const PASSWORD = __ENV.PASSWORD || "seed-pass-123";
const USERNAME_PREFIX = __ENV.USERNAME_PREFIX || "seed_user_";
const USER_POOL_SIZE = Number(__ENV.USER_POOL_SIZE || 200);
const MESSAGE_LIMIT = Number(__ENV.MESSAGE_LIMIT || 50);
const ROOM_URI = __ENV.ROOM_URI || "";
const ROOM_NAME_PREFIX = __ENV.ROOM_NAME_PREFIX || "seed_perf_hot_";

const VUS = Number(__ENV.VUS || 20);
const DURATION = __ENV.DURATION || "60s";
const THINK_TIME_MS = Number(__ENV.THINK_TIME_MS || 300);

export const options = {
  vus: VUS,
  duration: DURATION,
  noCookiesReset: true,
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1200"],
    "http_req_failed{api:messages_page1}": ["rate<0.01"],
    "http_req_failed{api:messages_page2}": ["rate<0.01"],
    "http_req_duration{api:messages_page1}": ["p(95)<1200"],
    "http_req_duration{api:messages_page2}": ["p(95)<1200"],
  },
};

let vuState = {
  ready: false,
  chatUri: null,
};

function usernameForVu() {
  const index = ((__VU - 1) % USER_POOL_SIZE) + 1;
  return `${USERNAME_PREFIX}${String(index).padStart(4, "0")}`;
}

function initVuSession() {
  if (!ROOM_URI) {
    throw new Error("ROOM_URI is required in strict mode. Example: -e ROOM_URI=<chat_uri>");
  }

  const username = usernameForVu();

  const csrfRes = http.get(`${BASE_URL}/api/auth/csrf/`, {
    tags: { api: "csrf" },
  });
  check(csrfRes, {
    "csrf endpoint 200": (r) => r.status === 200,
  });

  const jar = http.cookieJar();
  const csrfCookies = jar.cookiesForURL(BASE_URL).csrftoken || [];
  const csrfToken = csrfCookies[0];

  const loginRes = http.post(
    `${BASE_URL}/api/auth/login/`,
    JSON.stringify({ username, password: PASSWORD }),
    {
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken || "",
      },
      tags: { api: "login" },
    }
  );

  const loginOk = check(loginRes, {
    "login 200": (r) => r.status === 200,
  });

  if (!loginOk) {
    throw new Error(`Login failed for ${username}, status=${loginRes.status}`);
  }

  const roomsRes = http.get(`${BASE_URL}/api/chat/chatrooms/`, {
    tags: { api: "chatrooms_list" },
  });
  const roomsOk = check(roomsRes, {
    "chatrooms list 200": (r) => r.status === 200,
  });

  if (!roomsOk) {
    throw new Error(`Failed to fetch rooms for ${username}, status=${roomsRes.status}`);
  }

  const rooms = roomsRes.json();
  if (!Array.isArray(rooms) || rooms.length === 0) {
    throw new Error(`No rooms visible for ${username}. Seed data may be missing memberships.`);
  }

  const groupRooms = rooms.filter((room) => room.chat_type === "group");
  const selected = rooms.find((room) => room.uri === ROOM_URI) || null;
  if (!selected) {
    throw new Error(
      `Room ${ROOM_URI} is not visible to ${username}. Ensure this user is a member and ROOM_URI is correct.`
    );
  }

  vuState.ready = true;
  vuState.chatUri = selected.uri;
}

export default function () {
  if (!vuState.ready) {
    initVuSession();
  }

  const page1Res = http.get(
    `${BASE_URL}/api/chat/chatrooms/${vuState.chatUri}/messages/?limit=${MESSAGE_LIMIT}`,
    {
      tags: { api: "messages_page1" },
    }
  );
  const page1Ok = check(page1Res, {
    "messages page1 200": (r) => r.status === 200,
  });

  if (!page1Ok) {
    sleep(THINK_TIME_MS / 1000);
    return;
  }

  const payload = page1Res.json();
  const hasMore = Boolean(payload && payload.has_more);
  const nextBefore = payload && payload.next_before;

  check(payload, {
    "results array": (p) => Array.isArray(p && p.results),
  });

  if (hasMore && nextBefore) {
    const page2Res = http.get(
      `${BASE_URL}/api/chat/chatrooms/${vuState.chatUri}/messages/?limit=${MESSAGE_LIMIT}&before=${encodeURIComponent(nextBefore)}`,
      {
        tags: { api: "messages_page2" },
      }
    );
    check(page2Res, {
      "messages page2 200": (r) => r.status === 200,
    });
  }

  sleep(THINK_TIME_MS / 1000);
}
