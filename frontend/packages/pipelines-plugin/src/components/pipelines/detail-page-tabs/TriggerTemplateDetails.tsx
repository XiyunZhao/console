import * as React from 'react';
import { Grid, GridItem } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { SectionHeading, ResourceSummary } from '@console/internal/components/utils';
import PaneBody from '@console/shared/src/components/layout/PaneBody';
import { EventListenerModel, PipelineModel } from '../../../models';
import ResourceLinkList from '../resource-overview/ResourceLinkList';
import { TriggerTemplateKind } from '../resource-types';
import {
  useTriggerTemplateEventListenerNames,
  getTriggerTemplatePipelineName,
} from '../utils/triggers';

export interface TriggerTemplateDetailsProps {
  obj: TriggerTemplateKind;
}

const TriggerTemplateDetails: React.FC<TriggerTemplateDetailsProps> = ({
  obj: triggerTemplate,
}) => {
  const { t } = useTranslation();
  const eventListeners: string[] = useTriggerTemplateEventListenerNames(triggerTemplate);
  const pipelineName: string = getTriggerTemplatePipelineName(triggerTemplate);
  return (
    <PaneBody>
      <SectionHeading text={t('pipelines-plugin~TriggerTemplate details')} />
      <Grid hasGutter>
        <GridItem sm={6}>
          <ResourceSummary resource={triggerTemplate} />
        </GridItem>
        <GridItem sm={6}>
          <ResourceLinkList
            namespace={triggerTemplate.metadata.namespace}
            model={PipelineModel}
            links={[pipelineName]}
          />
          <ResourceLinkList
            namespace={triggerTemplate.metadata.namespace}
            model={EventListenerModel}
            links={eventListeners}
          />
        </GridItem>
      </Grid>
    </PaneBody>
  );
};

export default TriggerTemplateDetails;
