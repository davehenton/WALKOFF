from flask import current_app
from flask_jwt_extended import jwt_required

import core.config.config
import core.config.paths
from apps.devicedb import Device, device_db
from core import helpers
from server.returncodes import *
from server.security import roles_accepted_for_resources


def read_all_apps(interfaces_only=None, has_device_types=None):

    @jwt_required
    @roles_accepted_for_resources('apps')
    def __func():
        if interfaces_only:
            return helpers.list_apps_with_interfaces(), SUCCESS
        if has_device_types:
            return helpers.list_apps_with_device_types(), SUCCESS
        return helpers.list_apps(), SUCCESS

    return __func()


def __format_app_action_api(api):
    ret = {}
    if 'description' in api:
        ret['description'] = api['description']
    ret['args'] = api.get('parameters', [])
    returns = list(api['returns'].keys()) if 'returns' in api else ['Success']
    returns.extend(['UnhandledException', 'InvalidInput'])
    if 'event' in api:
        ret['event'] = api['event']
        returns.append('EventTimedOut')
    ret['returns'] = returns
    return ret


def __format_all_app_actions(app_api):
    return {action_name: __format_app_action_api(action_api)
            for action_name, action_api in app_api['actions'].items()}


@jwt_required
def read_all_app_actions():

    @roles_accepted_for_resources('apps')
    def __func():
        return {app_name: __format_all_app_actions(app_api)
                for app_name, app_api in core.config.config.app_apis.items()},  SUCCESS

    return __func()


@jwt_required
def list_app_actions(app_name):

    @roles_accepted_for_resources('apps')
    def __func():
        try:
            app_api = core.config.config.app_apis[app_name]
        except KeyError:
            current_app.logger.error('Could not get action for app {0}. App does not exist'.format(app_name))
            return {'error': 'App name not found.'}, OBJECT_DNE_ERROR
        else:
            return {'actions': __format_all_app_actions(app_api)}, SUCCESS

    return __func()


@jwt_required
def read_all_devices(app_name):

    @roles_accepted_for_resources('apps')
    def __func():
        if app_name in core.config.config.app_apis.keys():
            query = device_db.session.query(Device).all()
            output = []
            if query:
                for device in query:
                    if app_name == device.app_id:
                        output.append(device.as_json())
            return output, SUCCESS
        else:
            current_app.logger.error('Could not get devices for app {0}. App does not exist'.format(app_name))
            return {'error': 'App name not found.'}, OBJECT_DNE_ERROR

    return __func()
