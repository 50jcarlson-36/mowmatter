import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
test("database atomically publishes schedule, rejects stale/foreign/active jobs, and enforces quotas", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
 create table mow_crew_companies(id uuid primary key,name text);
 create table mow_crew_members(company_id uuid,user_id uuid,role text);
 create table mow_customer_channels(company_id uuid,customer_id uuid,phone text);
 create table mow_crew_jobs(id uuid primary key,company_id uuid references mow_crew_companies(id),assigned_to uuid,service_date date,scheduled_time time,planned_minutes integer,status text,updated_at timestamptz,customer_id uuid,cancelled_at timestamptz,cancellation_reason text);
 insert into mow_crew_companies values('${id(1)}','Fixture');
 insert into mow_crew_members values('${id(1)}','${id(2)}','owner'),('${id(1)}','${id(3)}','crew');
 insert into mow_crew_jobs(id,company_id,assigned_to,service_date,scheduled_time,planned_minutes,status,updated_at) values
 ('${id(4)}','${id(1)}','${id(3)}',current_date+1,'09:00',30,'scheduled','2026-10-14Z'),
 ('${id(5)}','${id(1)}','${id(3)}',current_date+1,'10:00',30,'scheduled','2026-10-14Z');`);
    await db.exec(
      await readFile(
        new URL(
          "../../supabase/migrations/20261013155801_customer_progress_dispatch.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../../supabase/migrations/20261014115944_operational_route_planning.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const rows = (
      await db.query(
        "select id,updated_at,service_date::text from mow_crew_jobs order by id",
      )
    ).rows;
    const payload = {
      crew_id: id(3),
      service_date: rows[0].service_date,
      time_zone: "UTC",
      jobs: rows.map((j, i) => ({
        id: j.id,
        updated_at: j.updated_at,
        scheduled_time: i ? "10:00" : "09:30",
        flexible: i === 0,
      })),
    };
    const publish = (p) =>
      db.query("select mow_route_plan_publish($1,$2,$3::jsonb)", [
        id(2),
        id(1),
        JSON.stringify(p),
      ]);
    const altered = structuredClone(payload);
    altered.jobs[1].scheduled_time = "10:30";
    await assert.rejects(publish(altered), /Fixed appointment/);
    assert.equal(
      (
        await db.query(
          "select scheduled_time::text from mow_crew_jobs where id=$1",
          [id(4)],
        )
      ).rows[0].scheduled_time,
      "09:00:00",
    );
    const foreign = structuredClone(payload);
    foreign.jobs[1].id = id(99);
    await assert.rejects(publish(foreign), /Visit changed/);
    await db.query(
      "update mow_crew_jobs set status='in_progress' where id=$1",
      [id(4)],
    );
    await assert.rejects(publish(payload), /work started/);
    await db.query("update mow_crew_jobs set status='scheduled' where id=$1", [
      id(4),
    ]);
    await publish(payload);
    const published = (
      await db.query(
        "select scheduled_time::text,route_position from mow_crew_jobs order by route_position",
      )
    ).rows;
    assert.deepEqual(published, [
      { scheduled_time: "09:30:00", route_position: 1 },
      { scheduled_time: "10:00:00", route_position: 2 },
    ]);
    assert.equal(
      (await db.query("select count(*)::int as n from mow_dispatch_routes"))
        .rows[0].n,
      1,
    );
    await assert.rejects(publish(payload), /Visit changed/);
    const reserve = () =>
      db.query("select mow_route_reserve($1,$2) as allowed", [id(2), id(1)]);
    assert.equal((await reserve()).rows[0].allowed, true);
    assert.equal((await reserve()).rows[0].allowed, false);
    await db.exec(
      "update mow_route_usage set requests=20,last_requested_at=now()-interval '1 minute'",
    );
    assert.equal((await reserve()).rows[0].allowed, false);
    await assert.rejects(
      db.query("select mow_route_reserve($1,$2)", [id(3), id(1)]),
      /Owner access/,
    );
    const permissions = (
      await db.query(
        "select has_function_privilege('authenticated','mow_route_plan_publish(uuid,uuid,jsonb)','EXECUTE') as can_publish,has_table_privilege('anon','mow_route_usage','SELECT') as can_read",
      )
    ).rows[0];
    assert.deepEqual(permissions, { can_publish: false, can_read: false });
  } finally {
    await db.close();
  }
});
