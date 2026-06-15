CREATE OR REPLACE FUNCTION notify_domain_event_outbox_inserted()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('domain_event_outbox_inserted', NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS domain_event_outbox_inserted_notify
ON "DomainEventOutbox";

CREATE TRIGGER domain_event_outbox_inserted_notify
AFTER INSERT ON "DomainEventOutbox"
FOR EACH ROW
EXECUTE FUNCTION notify_domain_event_outbox_inserted();