import { Given, When, Then } from 'cypress-cucumber-preprocessor/steps';
import { guidedTour } from '@console/cypress-integration-tests/views/guided-tour';
import { modal } from '@console/cypress-integration-tests/views/modal';
import { nav } from '@console/cypress-integration-tests/views/nav';
import {
  devNavigationMenu,
  switchPerspective,
  catalogCards,
  catalogTypes,
} from '@console/dev-console/integration-tests/support/constants';
import {
  topologyPage,
  gitPage,
  catalogPage,
  addPage,
  navigateTo,
  perspective,
  projectNameSpace,
  app,
  installKnativeOperatorUsingCLI,
} from '@console/dev-console/integration-tests/support/pages';
import { checkDeveloperPerspective } from '@console/dev-console/integration-tests/support/pages/functions/checkDeveloperPerspective';
import { userLoginPage } from '../../pages/functions/common';

Given('user has installed OpenShift Serverless Operator', () => {
  installKnativeOperatorUsingCLI();
});

Given('user has logged in as a basic user', () => {
  app.waitForDocumentLoad();
  userLoginPage.nonAdminUserlogin();
});

Given('user is at developer perspective', () => {
  checkDeveloperPerspective();
  perspective.switchTo(switchPerspective.Developer);
  cy.testA11y('Developer perspective with guide tour modal');
  guidedTour.close();
  nav.sidenav.switcher.shouldHaveText(switchPerspective.Developer);
  cy.testA11y('Developer perspective');
});

Given('user is at administrator perspective', () => {
  perspective.switchTo(switchPerspective.Administrator);
});

Given('user has created or selected namespace {string}', (projectName: string) => {
  Cypress.env('NAMESPACE', projectName);
  projectNameSpace.selectOrCreateProject(projectName);
  // eslint-disable-next-line cypress/no-unnecessary-waiting
  cy.wait(20000);
  cy.exec(
    `kubectl -n ${Cypress.env(
      'NAMESPACE',
    )} wait --for condition=established --timeout=80s crd/pipelineruns.tekton.dev`,
    {
      failOnNonZeroExit: false,
    },
  ).then(function (result) {
    cy.log(`STDOUT: ${result.stdout}`);
    cy.log(`STDERR: ${result.stderr}`);
  });
  cy.exec(
    `kubectl -n ${Cypress.env(
      'NAMESPACE',
    )} wait --for condition=established --timeout=80s crd/tasks.tekton.dev`,
    {
      failOnNonZeroExit: false,
    },
  ).then(function (result) {
    cy.log(`STDOUT: ${result.stdout}`);
    cy.log(`STDERR: ${result.stderr}`);
  });
  cy.exec(
    `oc apply -f testData/installTasksInsteadOfClusterTask.yaml -n ${Cypress.env('NAMESPACE')}`,
    {
      failOnNonZeroExit: false,
    },
  ).then(function (result) {
    cy.log(`STDOUT: ${result.stdout}`);
    cy.log(`STDERR: ${result.stderr}`);
  });
  cy.exec(
    `oc wait --for=condition=ready pod -l app=tekton-operator -n openshift-operators --timeout=800s`,
    {
      failOnNonZeroExit: false,
    },
  ).then(function (result) {
    cy.log(`STDOUT: ${result.stdout}`);
    cy.log(`STDERR: ${result.stderr}`);
  });
});

Given('user is at the Topology page', () => {
  navigateTo(devNavigationMenu.Topology);
  topologyPage.verifyTopologyPage();
});

When('user enters Git Repo URL as {string}', (gitUrl: string) => {
  gitPage.enterGitUrl(gitUrl);
  gitPage.verifyValidatedMessage(gitUrl);
  cy.get('body').then(($el) => {
    if ($el.find('[aria-label$="Alert"]').length) {
      cy.log('Builder image detected');
    }
  });
});

When('user creates the application with the selected builder image', () => {
  catalogPage.selectCatalogType(catalogTypes.BuilderImage);
  catalogPage.selectCardInCatalog(catalogCards.nodeJs);
  catalogPage.clickButtonOnCatalogPageSidePane();
});

When('user enters name as {string} in General section', (name: string) => {
  gitPage.enterComponentName(name);
});

When('user selects resource type as {string}', (resourceType: string) => {
  gitPage.selectResource(resourceType);
});

When('user clicks Create button on Add page', () => {
  gitPage.clickCreate();
});

Then('user will be redirected to Topology page', () => {
  topologyPage.verifyTopologyPage();
});

Then('user is able to see workload {string} in topology page', (workloadName: string) => {
  topologyPage.verifyWorkloadInTopologyPage(workloadName);
});

When('user clicks node {string} to open the side bar', (name: string) => {
  topologyPage.componentNode(name).click({ force: true });
});

When('user navigates to Topology page', () => {
  navigateTo(devNavigationMenu.Topology);
});

Then('modal with {string} appears', (header: string) => {
  modal.modalTitleShouldContain(header);
});

When('user clicks on workload {string}', (workloadName: string) => {
  topologyPage.componentNode(workloadName).click({ force: true });
});

When('user selects {string} card from add page', (cardName: string) => {
  addPage.selectCardFromOptions(cardName);
});
