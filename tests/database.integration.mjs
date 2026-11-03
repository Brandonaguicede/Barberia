import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

test("migraciones y motor PostgreSQL: reservas, permisos, tokens, auditoría y cola", async (t) => {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create publication supabase_realtime;`,
  );
  for (const file of (await fs.readdir("supabase/migrations")).sort()) {
    await db.exec(await fs.readFile(`supabase/migrations/${file}`, "utf8"));
  }
  const ids = {
    admin: "10000000-0000-4000-8000-000000000001",
    user: "10000000-0000-4000-8000-000000000002",
    other: "10000000-0000-4000-8000-000000000003",
    barber: "20000000-0000-4000-8000-000000000001",
    otherBarber: "20000000-0000-4000-8000-000000000002",
    service: "30000000-0000-4000-8000-000000000001",
  };
  await db.exec(
    `insert into auth.users values('${ids.admin}','admin@test.local'),('${ids.user}','barber@test.local'),('${ids.other}','other@test.local');insert into public.user_roles values('${ids.admin}','admin'),('${ids.user}','barber'),('${ids.other}','barber');insert into public.barbers(id,user_id,name) values('${ids.barber}','${ids.user}','Ángel'),('${ids.otherBarber}','${ids.other}','Otro');insert into services(id,name,duration,price) values('${ids.service}','Corte',45,8000);insert into barber_services values('${ids.barber}','${ids.service}'),('${ids.otherBarber}','${ids.service}');insert into barber_schedules(barber_id,weekday,opens_at,closes_at) select b.id,d,'09:00','18:00' from barbers b cross join generate_series(0,6) d;`,
  );
  const { rows: [{ date }] } = await db.query(
    "select ((now() at time zone 'America/Costa_Rica')::date+3)::text date",
  );
  const body = {
    barber_id: ids.barber,
    service_id: ids.service,
    appointment_date: date,
    appointment_time: "09:00",
    client_name: "Ana",
    client_phone: "88881234",
  };
  const hash = "a".repeat(64), nextHash = "b".repeat(64);
  let appointment;
  await t.test("crea confirmada con precio/duración históricos y notificación atómica", async () => {
    const { rows } = await db.query(
      "select create_booking($1::jsonb,$2) value",
      [JSON.stringify(body), hash],
    );
    appointment = rows[0].value;
    assert.equal(appointment.status, "confirmed");
    assert.equal(appointment.service_price, 8000);
    assert.equal(appointment.service_duration, 45);
    assert.equal(appointment.appointment_time, "09:00");
    assert.equal(
      (await db.query("select count(*)::int n from notifications")).rows[0].n,
      1,
    );
    assert.equal(
      (await db.query("select count(*)::int n from appointment_events")).rows[0]
        .n,
      1,
    );
  });
  await t.test("rechaza doble reserva y solapamiento parcial sin dejar clientes huérfanos", async () => {
    for (const time of ["09:00", "09:15"]) {
      await assert.rejects(
        db.query("select create_booking($1::jsonb,$2)", [
          JSON.stringify({ ...body, appointment_time: time }),
          "c".repeat(64),
        ]),
      );
    }
    assert.equal(
      (await db.query("select count(*)::int n from customers")).rows[0].n,
      1,
    );
    // Fail after customer, appointment and notification inserts: all must roll back.
    await assert.rejects(db.query('select create_booking($1,$2)',[JSON.stringify({...body,appointment_time:'14:00'}),hash]));
    assert.equal((await db.query('select count(*)::int n from customers')).rows[0].n,1);
    assert.equal((await db.query('select count(*)::int n from appointment_events')).rows[0].n,1);
    assert.equal((await db.query('select count(*)::int n from notifications')).rows[0].n,1);
    // Constraint independently protects direct inserts, even if application checks are bypassed.
    await assert.rejects(
      db.exec(
        `insert into appointments(customer_id,barber_id,service_id,client_name,client_phone,service_name,service_duration,service_price,starts_at,ends_at,blocked_until) select customer_id,barber_id,service_id,client_name,client_phone,service_name,service_duration,service_price,starts_at,ends_at,blocked_until from appointments limit 1`,
      ),
      (e) => e.code === "23P01",
    );
  });
  await t.test("descansos, bloqueos, asignaciones e intervalo de 15 minutos", async () => {
    await db.exec(
      `insert into barber_breaks(barber_id,weekday,starts_at,ends_at) values('${ids.barber}',extract(dow from '${date}'::date),'12:00','13:00')`,
    );
    const { rows } = await db.query("select * from available_slots($1,$2,$3)", [
      ids.service,
      ids.barber,
      date,
    ]);
    assert.ok(rows.length > 0);
    assert.ok(!rows.some((r) => new Date(r.starts_at).getUTCHours() === 18));
    assert.ok(
      !rows.some((r) => new Date(r.starts_at).getUTCMinutes() % 15 !== 0),
    );
    await assert.rejects(
      db.exec(
        `insert into barber_time_off(barber_id,starts_at,ends_at) values('${ids.barber}','${date}T09:00:00-06:00','${date}T10:00:00-06:00')`,
      ),
    );
    await assert.rejects(
      db.query("select create_booking($1,$2)", [
        JSON.stringify({ ...body, appointment_time: "09:07" }),
        "d".repeat(64),
      ]),
    );
  });
  await t.test("anónimo sin acceso a tablas ni RPC privado", async () => {
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from appointments"));
    await assert.rejects(
      db.query("select private_booking($1,$2)", [hash, "get"]),
    );
    await db.exec("reset role");
  });
  await t.test("barbero ve solo sus citas y no puede elevar roles", async () => {
    await db.exec(
      `set role authenticated;set request.jwt.claim.sub='${ids.other}'`,
    );
    assert.equal(
      (await db.query("select count(*)::int n from appointments")).rows[0].n,
      0,
    );
    await assert.rejects(
      db.query("select staff_update_appointment($1,$2)", [
        appointment.id,
        JSON.stringify({ status: "cancelled" }),
      ]),
    );
    await assert.rejects(
      db.exec(
        `insert into user_roles(user_id,role) values('${ids.other}','admin') on conflict(user_id) do update set role='admin'`,
      ),
    );
    await db.exec(`set request.jwt.claim.sub='${ids.user}'`);
    assert.equal(
      (await db.query("select count(*)::int n from appointments")).rows[0].n,
      1,
    );
    await assert.rejects(
      db.query("select staff_update_appointment($1,$2)", [
        appointment.id,
        JSON.stringify({ status: "completed" }),
      ]),
    );
    await db.exec("reset role");
  });
  await t.test("reprogramación atómica rota el enlace y conserva snapshot", async () => {
    await db.exec(
      `update services set duration=60,price=9000 where id='${ids.service}'`,
    );
    const { rows } = await db.query(
      "select private_booking($1,$2,$3,$4) value",
      [
        hash,
        "reschedule",
        JSON.stringify({ appointment_date: date, appointment_time: "10:00" }),
        nextHash,
      ],
    );
    assert.equal(rows[0].value.service_duration, 45);
    assert.equal(rows[0].value.service_price, 8000);
    await assert.rejects(
      db.query("select private_booking($1,$2)", [hash, "get"]),
    );
    const { rows: tokens } = await db.query(
      "select token_hash from booking_access_tokens",
    );
    assert.ok(tokens.every((x) => x.token_hash.length === 64));
  });
  await t.test("cancelación libera horario, expiración y revocación se aplican", async () => {
    const { rows } = await db.query("select private_booking($1,$2) value", [
      nextHash,
      "cancel",
    ]);
    assert.equal(rows[0].value.status, "cancelled");
    await assert.rejects(
      db.query("select private_booking($1,$2)", [nextHash, "cancel"]),
    );
    await db.exec(
      `update booking_access_tokens set expires_at=now()-interval '1 day' where token_hash='${nextHash}'`,
    );
    await assert.rejects(
      db.query("select private_booking($1,$2)", [nextHash, "get"]),
    );
    assert.ok(
      (await db.query("select * from available_slots($1,$2,$3)", [
        ids.service,
        ids.barber,
        date,
      ])).rows.some((x) => new Date(x.starts_at).getUTCHours() === 16),
    );
  });
  await t.test("límite de intentos persistente y cola sin duplicados", async () => {
    assert.equal(
      (await db.query("select consume_rate_limit('test',1,600) ok")).rows[0].ok,
      true,
    );
    assert.equal(
      (await db.query("select consume_rate_limit('test',1,600) ok")).rows[0].ok,
      false,
    );
    await db.exec(
      `insert into push_subscriptions(user_id,endpoint,p256dh,auth) values('${ids.user}','https://fcm.googleapis.com/test','${
        "a".repeat(80)
      }','${
        "b".repeat(24)
      }');select notify_appointment('${appointment.id}','test','Prueba');select notify_appointment('${appointment.id}','test','Prueba')`,
    );
    assert.equal(
      (await db.query("select count(*)::int n from push_jobs")).rows[0].n,
      1,
    );
    assert.equal(
      (await db.query("select * from claim_push_jobs()")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from claim_push_jobs()")).rows.length,
      0,
    );
  });
  await t.test('plazos, horizonte, buffers y permisos de disponibilidad se validan en servidor', async () => {
    await db.exec('update booking_settings set buffer_minutes=15 where id');
    const {rows:[{value:newAppointment}]}=await db.query('select create_booking($1,$2) value',[JSON.stringify({...body,appointment_time:'14:00'}),'e'.repeat(64)]);
    assert.equal(new Date(newAppointment.blocked_until).getTime()-new Date(newAppointment.ends_at).getTime(),15*60000);
    await assert.rejects(db.query('select create_booking($1,$2)',[JSON.stringify({...body,appointment_time:'15:00'}),'f'.repeat(64)]));
    await db.exec('update booking_settings set cancellation_notice_minutes=10080,reschedule_notice_minutes=10080 where id');
    await assert.rejects(db.query('select private_booking($1,$2)',['e'.repeat(64),'cancel']));
    await assert.rejects(db.query('select private_booking($1,$2,$3,$4)',['e'.repeat(64),'reschedule',JSON.stringify({appointment_date:date,appointment_time:'16:00'}),'f'.repeat(64)]));
    assert.equal((await db.query('select * from available_slots($1,$2,$3)',[ids.service,ids.barber,'2099-01-01'])).rows.length,0);
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${ids.user}'`);
    await assert.rejects(db.exec(`insert into barber_breaks(barber_id,weekday,starts_at,ends_at) values('${ids.barber}',0,'10:00','11:00')`));
    await db.exec('reset role;update booking_settings set barber_can_manage_availability=true where id');
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${ids.user}';insert into barber_breaks(barber_id,weekday,starts_at,ends_at) values('${ids.barber}',0,'10:00','11:00')`);
    await assert.rejects(db.exec(`insert into barber_breaks(barber_id,weekday,starts_at,ends_at) values('${ids.otherBarber}',0,'10:00','11:00')`));
    await db.exec('reset role');
  });
  await t.test('gestión administrativa atómica y protección de perfiles',async()=>{
    await assert.rejects(db.query('select admin_manage_profile($1,$2,$3)',[ids.admin,ids.user,JSON.stringify({active:false,barber_id:ids.otherBarber})]));
    assert.equal((await db.query('select active from profiles where id=$1',[ids.user])).rows[0].active,true);
    await assert.rejects(db.query('select admin_manage_profile($1,$2,$3)',[ids.user,ids.admin,JSON.stringify({active:false})]));
    await db.query('select admin_manage_profile($1,$2,$3)',[ids.admin,ids.user,JSON.stringify({active:false})]);
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${ids.user}'`);
    assert.equal((await db.query('select count(*)::int n from appointments')).rows[0].n,0);
    await db.exec('reset role');
  });
  await db.close();
});
