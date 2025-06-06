import * as _ from 'lodash-es';
import { css } from '@patternfly/react-styles';
import { useDispatch, connect } from 'react-redux';
import { sortable } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';
import { ChartDonut } from '@patternfly/react-charts/victory';
import { useExtensions } from '@console/plugin-sdk';
import {
  isPVCAlert,
  isPVCCreateProp,
  isPVCStatus,
} from '@console/dynamic-plugin-sdk/src/extensions/pvc';
import { useResolvedExtensions } from '@console/dynamic-plugin-sdk';
import {
  Status,
  FLAGS,
  calculateRadius,
  getNamespace,
  getName,
  getRequestedPVCSize,
} from '@console/shared';
import PaneBody from '@console/shared/src/components/layout/PaneBody';
import { connectToFlags } from '../reducers/connectToFlags';
import { Conditions } from './conditions';
import { DetailsPage, ListPage, Table, TableData } from './factory';
import {
  Kebab,
  navFactory,
  ResourceKebab,
  SectionHeading,
  ResourceLink,
  ResourceSummary,
  Selector,
  humanizeBinaryBytes,
  convertToBaseValue,
  asAccessReview,
} from './utils';
import { ResourceEventStream } from './events';
import { PersistentVolumeClaimModel } from '../models';
import { setPVCMetrics } from '../actions/ui';
import { PrometheusEndpoint } from './graphs/helpers';
import { usePrometheusPoll } from './graphs/prometheus-poll-hook';
import deletePVCModal from './modals/delete-pvc-modal';
import i18next from 'i18next';
import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Grid,
  GridItem,
} from '@patternfly/react-core';

const { ModifyLabels, ModifyAnnotations, Edit, ExpandPVC, PVCSnapshot, ClonePVC } = Kebab.factory;
const menuActions = [
  ...Kebab.getExtensionsActionsForKind(PersistentVolumeClaimModel),
  ExpandPVC,
  PVCSnapshot,
  ClonePVC,
  ModifyLabels,
  ModifyAnnotations,
  Edit,
  (kind, pvc) => ({
    label: i18next.t('public~Delete PersistentVolumeClaim'),
    callback: () =>
      deletePVCModal({
        pvc,
      }),
    accessReview: asAccessReview(kind, pvc, 'delete'),
  }),
];

export const PVCStatus = ({ pvc }) => {
  const { t } = useTranslation();
  const [pvcStatusExtensions, resolved] = useResolvedExtensions(isPVCStatus);
  if (resolved && pvcStatusExtensions.length > 0) {
    const sortedByPriority = pvcStatusExtensions.sort(
      (a, b) => b.properties.priority - a.properties.priority,
    );
    const priorityStatus = sortedByPriority.find((status) => status.properties.predicate(pvc));
    const PriorityStatusComponent = priorityStatus?.properties?.status;

    return PriorityStatusComponent ? (
      <PriorityStatusComponent pvc={pvc} />
    ) : (
      <Status
        status={pvc.metadata.deletionTimestamp ? t('public~Terminating') : pvc.status.phase}
      />
    );
  }

  return (
    <Status status={pvc.metadata.deletionTimestamp ? t('public~Terminating') : pvc.status.phase} />
  );
};

const tableColumnClasses = [
  '', // name
  '', // namespace
  css('pf-m-hidden', 'pf-m-visible-on-lg'), // status
  css('pf-m-hidden', 'pf-m-visible-on-xl'), // persistence volume
  css('pf-m-hidden', 'pf-m-visible-on-xl'), // capacity
  css('pf-m-hidden', 'pf-m-visible-on-2xl'), // used capacity
  css('pf-m-hidden', 'pf-m-visible-on-2xl'), // storage class
  Kebab.columnClass,
];

const kind = 'PersistentVolumeClaim';

const mapStateToProps = ({ UI }, { obj }) => ({
  metrics: UI.getIn(['metrics', 'pvc'])?.usedCapacity?.[getNamespace(obj)]?.[getName(obj)],
});

const PVCTableRow = connect(mapStateToProps)(({ obj, metrics }) => {
  const [name, namespace] = [getName(obj), getNamespace(obj)];
  const totalCapacityMetric = convertToBaseValue(obj?.status?.capacity?.storage);
  const totalCapcityHumanized = humanizeBinaryBytes(totalCapacityMetric);
  const usedCapacity = humanizeBinaryBytes(metrics);
  const { t } = useTranslation();
  return (
    <>
      <TableData className={tableColumnClasses[0]}>
        <ResourceLink kind={kind} name={name} namespace={namespace} title={name} />
      </TableData>
      <TableData className={css(tableColumnClasses[1], 'co-break-word')} columnID="namespace">
        <ResourceLink kind="Namespace" name={namespace} title={namespace} />
      </TableData>
      <TableData className={tableColumnClasses[2]}>
        <PVCStatus pvc={obj} />
      </TableData>
      <TableData className={tableColumnClasses[3]}>
        {_.get(obj, 'spec.volumeName') ? (
          <ResourceLink
            kind="PersistentVolume"
            name={obj.spec.volumeName}
            title={obj.spec.volumeName}
          />
        ) : (
          <div className="pf-v6-u-text-color-subtle">{t('public~No PersistentVolume')}</div>
        )}
      </TableData>
      <TableData className={tableColumnClasses[4]}>
        {totalCapacityMetric ? totalCapcityHumanized.string : '-'}
      </TableData>
      <TableData className={tableColumnClasses[5]}>{metrics ? usedCapacity.string : '-'}</TableData>
      <TableData className={css(tableColumnClasses[6])}>
        {obj?.spec?.storageClassName ? (
          <ResourceLink
            kind="StorageClass"
            name={obj.spec.storageClassName}
            title={obj.spec.storageClassName}
          />
        ) : (
          '-'
        )}
      </TableData>
      <TableData className={tableColumnClasses[7]}>
        <ResourceKebab actions={menuActions} kind={kind} resource={obj} />
      </TableData>
    </>
  );
});

const Details_ = ({ flags, obj: pvc }) => {
  const canListPV = flags[FLAGS.CAN_LIST_PV];
  const name = pvc?.metadata?.name;
  const namespace = pvc?.metadata?.namespace;
  const labelSelector = pvc?.spec?.selector;
  const storageClassName = pvc?.spec?.storageClassName;
  const volumeName = pvc?.spec?.volumeName;
  const storage = pvc?.status?.capacity?.storage;
  const requestedStorage = getRequestedPVCSize(pvc);
  const accessModes = pvc?.status?.accessModes;
  const volumeMode = pvc?.spec?.volumeMode;
  const conditions = pvc?.status?.conditions;
  const query =
    name && namespace
      ? `kubelet_volume_stats_used_bytes{persistentvolumeclaim='${name}',namespace='${namespace}'}`
      : '';
  const [response, loadError, loading] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    namespace,
    query,
  });

  const totalCapacityMetric = convertToBaseValue(storage);
  const totalRequestMetric = convertToBaseValue(requestedStorage);
  const usedMetrics = response?.data?.result?.[0]?.value?.[1];
  const availableMetrics = usedMetrics ? totalCapacityMetric - usedMetrics : null;
  const totalCapacity = humanizeBinaryBytes(totalCapacityMetric);
  const availableCapacity = humanizeBinaryBytes(availableMetrics, undefined, totalCapacity.unit);
  const usedCapacity = humanizeBinaryBytes(usedMetrics, undefined, totalCapacity.unit);
  const { podStatusInnerRadius: innerRadius, podStatusOuterRadius: radius } = calculateRadius(130);
  const availableCapacityString = `${Number(availableCapacity.value.toFixed(1))} ${
    availableCapacity.unit
  }`;
  const totalCapacityString = `${Number(totalCapacity.value.toFixed(1))} ${totalCapacity.unit}`;

  const donutData = usedMetrics
    ? [
        { x: i18next.t('public~Used'), y: usedCapacity.value },
        { x: i18next.t('public~Available'), y: availableCapacity.value },
      ]
    : [{ x: i18next.t('public~Total'), y: totalCapacity.value }];

  const [pvcAlertExtensions] = useResolvedExtensions(isPVCAlert);
  const alertComponents = pvcAlertExtensions?.map(
    ({ properties: { alert: AlertComponent }, uid }) => <AlertComponent key={uid} pvc={pvc} />,
  );
  const { t } = useTranslation();
  return (
    <>
      <PaneBody>
        {alertComponents}
        <SectionHeading text={t('public~PersistentVolumeClaim details')} />
        {totalCapacityMetric && !loading && (
          <div className="co-pvc-donut">
            <ChartDonut
              ariaDesc={
                availableMetrics
                  ? t('public~Available versus used capacity')
                  : t('public~Total capacity')
              }
              ariaTitle={
                availableMetrics
                  ? t('public~Available versus used capacity')
                  : t('public~Total capacity')
              }
              height={130}
              width={130}
              size={130}
              innerRadius={innerRadius}
              radius={radius}
              data={donutData}
              labels={({ datum }) => `${datum.y} ${totalCapacity.unit} ${datum.x}`}
              subTitle={availableMetrics ? t('public~Available') : t('public~Total')}
              title={availableMetrics ? availableCapacityString : totalCapacityString}
              constrainToVisibleArea={true}
            />
          </div>
        )}
        <Grid hasGutter>
          <GridItem sm={6}>
            <ResourceSummary resource={pvc}>
              <DescriptionListGroup>
                <DescriptionListTerm>{t('public~Label selector')}</DescriptionListTerm>
                <DescriptionListDescription data-test-id="pvc-name">
                  <Selector selector={labelSelector} kind="PersistentVolume" />
                </DescriptionListDescription>
              </DescriptionListGroup>
            </ResourceSummary>
          </GridItem>
          <GridItem sm={6}>
            <DescriptionList>
              <DescriptionListGroup>
                <DescriptionListTerm>{t('public~Status')}</DescriptionListTerm>
                <DescriptionListDescription data-test-id="pvc-status">
                  <PVCStatus pvc={pvc} />
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>{t('public~Requested capacity')}</DescriptionListTerm>
                <DescriptionListDescription data-test="pvc-requested-capacity">
                  {humanizeBinaryBytes(totalRequestMetric).string}
                </DescriptionListDescription>
              </DescriptionListGroup>
              {storage && (
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('public~Capacity')}</DescriptionListTerm>
                  <DescriptionListDescription data-test-id="pvc-capacity">
                    {totalCapacity.string}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
              {usedMetrics && _.isEmpty(loadError) && !loading && (
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('public~Used')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {humanizeBinaryBytes(usedMetrics).string}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
              {!_.isEmpty(accessModes) && (
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('public~Access modes')}</DescriptionListTerm>
                  <DescriptionListDescription data-test-id="pvc-access-mode">
                    {accessModes.join(', ')}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
              <DescriptionListGroup>
                <DescriptionListTerm>{t('public~Volume mode')}</DescriptionListTerm>
                <DescriptionListDescription data-test-id="pvc-volume-mode">
                  {volumeMode || 'Filesystem'}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>{t('public~StorageClasses')}</DescriptionListTerm>
                <DescriptionListDescription data-test-id="pvc-storageclass">
                  {storageClassName ? (
                    <ResourceLink kind="StorageClass" name={storageClassName} />
                  ) : (
                    '-'
                  )}
                </DescriptionListDescription>
              </DescriptionListGroup>
              {volumeName && canListPV && (
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('public~PersistentVolumes')}</DescriptionListTerm>
                  <DescriptionListDescription data-test-id="persistent-volume">
                    <ResourceLink kind="PersistentVolume" name={volumeName} />
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
            </DescriptionList>
          </GridItem>
        </Grid>
      </PaneBody>
      <PaneBody>
        <SectionHeading text={t('public~Conditions')} />
        <Conditions conditions={conditions} />
      </PaneBody>
    </>
  );
};

const Details = connectToFlags(FLAGS.CAN_LIST_PV)(Details_);

export const PersistentVolumeClaimsList = (props) => {
  const { t } = useTranslation();
  const PVCTableHeader = () => {
    return [
      {
        title: t('public~Name'),
        sortField: 'metadata.name',
        transforms: [sortable],
        props: { className: tableColumnClasses[0] },
      },
      {
        title: t('public~Namespace'),
        sortField: 'metadata.namespace',
        transforms: [sortable],
        props: { className: tableColumnClasses[1] },
        id: 'namespace',
      },
      {
        title: t('public~Status'),
        sortField: 'status.phase',
        transforms: [sortable],
        props: { className: tableColumnClasses[2] },
      },
      {
        title: t('public~PersistentVolumes'),
        sortField: 'spec.volumeName',
        transforms: [sortable],
        props: { className: tableColumnClasses[3] },
      },
      {
        title: t('public~Capacity'),
        sortFunc: 'pvcStorage',
        transforms: [sortable],
        props: { className: tableColumnClasses[4] },
      },
      {
        title: t('public~Used'),
        sortFunc: 'pvcUsed',
        transforms: [sortable],
        props: { className: tableColumnClasses[5] },
      },
      {
        sortField: 'spec.storageClassName',
        title: t('public~StorageClass'),
        transforms: [sortable],
        props: { className: tableColumnClasses[6] },
      },
      {
        title: '',
        props: { className: tableColumnClasses[7] },
      },
    ];
  };
  return (
    <Table
      {...props}
      aria-label={t('public~PersistentVolumeClaims')}
      Header={PVCTableHeader}
      Row={PVCTableRow}
      virtualize
    />
  );
};

export const PersistentVolumeClaimsPage = (props) => {
  const { t } = useTranslation();
  const createPropExtensions = useExtensions(isPVCCreateProp);
  const { namespace = undefined } = props;
  const dispatch = useDispatch();
  const [response, loadError, loading] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    namespace,
    query: 'kubelet_volume_stats_used_bytes',
  });
  const pvcMetrics =
    _.isEmpty(loadError) && !loading
      ? response?.data?.result?.reduce((acc, item) => {
          _.set(
            acc,
            ['usedCapacity', item?.metric?.namespace, item?.metric?.persistentvolumeclaim],
            Number(item?.value?.[1]),
          );
          return acc;
        }, {})
      : {};
  dispatch(setPVCMetrics(pvcMetrics));
  const initPath = `/k8s/ns/${props.namespace || 'default'}/persistentvolumeclaims/`;

  const createItems = createPropExtensions.map(({ properties: { label, path } }, i) => ({
    key: i + 1,
    label,
    path,
  }));

  const createProps =
    createPropExtensions.length === 0
      ? { to: initPath.concat('~new/form') }
      : {
          items: Object.assign(
            { 0: 'With Form' },
            ...createItems.map(({ key, label }) => ({ [key]: label })),
          ),
          createLink: (wizardName) => {
            if (wizardName === '0') {
              return initPath.concat('~new/form');
            }
            const item = createItems.find(({ key }) => key.toString() === wizardName);
            return initPath.concat(item.path);
          },
        };

  const allPhases = ['Pending', 'Bound', 'Lost'];

  const filters = [
    {
      filterGroupName: t('public~Status'),
      type: 'pvc-status',
      reducer: (pvc) => pvc.status.phase,
      items: _.map(allPhases, (phase) => ({
        id: phase,
        title: phase,
      })),
    },
  ];

  return (
    <ListPage
      {...props}
      ListComponent={PersistentVolumeClaimsList}
      kind={kind}
      canCreate={true}
      rowFilters={filters}
      createProps={createProps}
      customData={pvcMetrics}
    />
  );
};

export const PersistentVolumeClaimsDetailsPage = (props) => {
  const { t } = useTranslation();
  return (
    <DetailsPage
      {...props}
      getResourceStatus={(pvc) =>
        pvc.metadata.deletionTimestamp ? t('public~Terminating') : pvc.status.phase
      }
      menuActions={menuActions}
      pages={[
        navFactory.details(Details),
        navFactory.editYaml(),
        navFactory.events(ResourceEventStream),
      ]}
    />
  );
};
