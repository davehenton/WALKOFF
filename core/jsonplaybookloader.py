import json
import logging
import os.path

import core.config.paths
from core.executionelements.playbook import Playbook
from core.executionelements.workflow import Workflow
from core.helpers import (locate_playbooks_in_directory, InvalidInput, UnknownApp, UnknownAppAction,
                          UnknownFilter, UnknownFlag, format_exception_message)

logger = logging.getLogger(__name__)


class JsonPlaybookLoader(object):

    @staticmethod
    def load_workflow(resource, workflow_name):
        """Loads a workflow from a file.

        Args:
            resource (str): Path to the workflow.
            workflow_name (str): Name of the workflow to load.

        Returns:
            True on success, False otherwise.
        """
        try:
            playbook_file = open(resource, 'r')
        except (IOError, OSError) as e:
            logger.error('Could not load workflow from {0}. Reason: {1}'.format(resource, format_exception_message(e)))
            return None
        else:
            with playbook_file:
                workflow_loaded = playbook_file.read()
                try:
                    playbook_json = json.loads(workflow_loaded)
                    playbook_name = playbook_json['name']
                    workflow_json = next(
                        (workflow for workflow in playbook_json['workflows']
                         if workflow['name'] == workflow_name), None)
                    if workflow_json is None:
                        logger.warning('Workflow {0} not found in playbook {0}. '
                                       'Cannot load.'.format(workflow_name, playbook_name))
                        return None
                    workflow = Workflow.create(workflow_json)
                    return playbook_name, workflow
                except ValueError as e:
                    logger.error('Cannot parse {0}. Reason: {1}'.format(resource, format_exception_message(e)))
                except (InvalidInput, UnknownApp, UnknownAppAction, UnknownFilter, UnknownFlag) as e:
                    logger.error('Error constructing workflow {0}. Reason: {1}'.format(workflow_name,
                                                                                       format_exception_message(e)))
                    return None
                except KeyError as e:
                    logger.error('Invalid Playbook JSON format. Details: {}'.format(e))
                    return None

    @staticmethod
    def load_playbook(resource):
        """Loads a playbook from a file.

        Args:
            resource (str): Path to the workflow.
        """
        try:
            playbook_file = open(resource, 'r')
        except (IOError, OSError) as e:
            logger.error('Could not load workflow from {0}. Reason: {1}'.format(resource, format_exception_message(e)))
            return None
        else:
            with playbook_file:
                workflow_loaded = playbook_file.read()
                try:
                    playbook_json = json.loads(workflow_loaded)
                    return Playbook.create(playbook_json)
                except ValueError:
                    logger.error('Cannot parse {}'.format(resource))
                except (InvalidInput, UnknownApp, UnknownAppAction, UnknownFilter, UnknownFlag) as e:
                    logger.error(
                        'Error constructing playbook from {0}. '
                        'Reason: {1}'.format(resource, format_exception_message(e)))
                    return None

    @staticmethod
    def load_playbooks(resource_collection=None):
        """Loads all playbooks from a directory.

        Args:
            resource_collection (str, optional): Path to the directory to load from. Defaults to the configuration
                workflows_path.
        """

        if resource_collection is None:
            resource_collection = core.config.paths.workflows_path
        playbooks = [JsonPlaybookLoader.load_playbook(os.path.join(resource_collection, playbook))
                     for playbook in locate_playbooks_in_directory(resource_collection)]
        return [playbook for playbook in playbooks if playbook]