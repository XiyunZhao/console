import * as React from 'react';
import { SectionHeading, ResourceSummary } from '@console/internal/components/utils';
import { EventListenerKind } from '../resource-types';
import EventListenerURL from './EventListenerURL';
import EventListenerTriggers from './EventListenerTriggers';

export interface EventListenerDetailsProps {
  obj: EventListenerKind;
}

const EventListenerDetails: React.FC<EventListenerDetailsProps> = ({ obj: eventListener }) => {
  const triggers = eventListener.spec.triggers?.filter((trigger) => trigger.template?.name) || [];
  return (
    <div className="co-m-pane__body">
      <SectionHeading text="Event Listener Details" />
      <div className="row">
        <div className="col-sm-6">
          <ResourceSummary resource={eventListener} />
        </div>
        <div className="col-sm-6">
          <EventListenerURL
            eventListener={eventListener}
            namespace={eventListener.metadata.namespace}
          />
          {triggers.length > 0 && (
            <EventListenerTriggers
              namespace={eventListener.metadata.namespace}
              triggers={triggers}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default EventListenerDetails;