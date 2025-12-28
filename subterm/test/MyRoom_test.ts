import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";

// import your "app.config.ts" file here.
import appConfig from "../src/app.config";
import { MyRoomState } from "../src/rooms/schema/MyRoomState";

describe("testing your Colyseus app", () => {
  let colyseus: ColyseusTestServer;

  before(async () => colyseus = await boot(appConfig));
  after(async () => colyseus.shutdown());

  beforeEach(async () => await colyseus.cleanup());

  it("connecting into a room", async () => {
    // `room` is the server-side Room instance reference.
    const room = await colyseus.createRoom<MyRoomState>("my_room", {});

    // `client1` is the client-side `Room` instance reference (same as JavaScript SDK)
    const client1 = await colyseus.connectTo(room);

    // make your assertions
    assert.strictEqual(client1.sessionId, room.clients[0].sessionId);

    // assert server-side state first
    const serverState = room.state as MyRoomState;
    assert.ok(serverState.map.width > 0, "server map.width should be initialized");
    assert.ok(serverState.map.height > 0, "server map.height should be initialized");
    assert.strictEqual(serverState.map.tiles.length, serverState.map.height, "server tiles row count should equal map height");

    // wait until client's state has map defined (event-based)
    const state: MyRoomState = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("client state patch timeout")), 12000);
      // immediate=true to receive current state if already available
      (client1 as any).onStateChange((s: MyRoomState) => {
        if (s && (s as any).map && (s as any).map.width > 0) {
          clearTimeout(timeout);
          resolve(s);
        }
      }, true);
    });
    assert.ok(!!state.map, "client state.map should be defined");
    assert.ok(state.map.width > 0 && state.map.height > 0, "client map dimensions should be initialized");
    assert.strictEqual(state.map.tiles.length, state.map.height, "client tiles row count should equal map height");
    assert.strictEqual(state.player.name, "Player");
    assert.ok(typeof state.player.x === "number" && typeof state.player.y === "number", "client player position should be numeric");
  });
});
