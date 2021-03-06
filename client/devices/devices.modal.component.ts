import { Component, Input, AfterViewInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { NgbModal, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastyService, ToastyConfig, ToastOptions, ToastData } from 'ng2-toasty';

import { DevicesService } from './devices.service';

import { WorkingDevice } from '../models/device';
import { DeviceType } from '../models/deviceType';

@Component({
	selector: 'device-modal',
	templateUrl: 'client/devices/devices.modal.html',
	styleUrls: [
		'client/devices/devices.css'
	],
	providers: [DevicesService]
})
export class DevicesModalComponent {
	@Input() workingDevice: WorkingDevice = new WorkingDevice();
	@Input() title: string;
	@Input() submitText: string;
	@Input() appNames: string[] = [];
	@Input() deviceTypes: DeviceType[] = [];
	@ViewChild('typeRef') typeRef: ElementRef;
	// @ViewChild('deviceForm') form: FormGroup

	deviceTypesForApp: DeviceType[] = [];
	// save device type fields on saving/loading so we don't clear all progress if we switch device type
	// e.g. { 'router': { 'ip': '127.0.0.1', ... }, ... }
	deviceTypeFields: { [key: string]: {} } = {};
	selectedDeviceType: DeviceType;
	validationErrors: { [key: string]: string } = {};
	encryptedConfirmFields: { [key: string]: string } = {};
	encryptedFieldsToBeCleared: { [key: string]: boolean } = {};

	constructor(private devicesService: DevicesService, private activeModal: NgbActiveModal, private toastyService: ToastyService, 
		private toastyConfig: ToastyConfig, private cdr: ChangeDetectorRef) {
		this.toastyConfig.theme = 'bootstrap';
	}

	ngAfterViewInit(): void {
		//For an existing device, set our available device types and store the known fields for our device type
		if (this.workingDevice.app) {
			this.deviceTypesForApp = this.deviceTypes.filter(dt => dt.app === this.workingDevice.app);
		}
		//Detect changes beforehand so the select box is updated
		this.cdr.detectChanges();
		if (this.workingDevice.type) {
			this.deviceTypeFields[this.workingDevice.type] = this.workingDevice.fields;
			this.typeRef.nativeElement.value = this.workingDevice.type;
			this.handleDeviceTypeSelection(null, this.workingDevice.type);
		}
		//Detect changes once more to actually use the selected device type
		this.cdr.detectChanges();
	}

	handleAppSelection(event: any, app: string): void {
		this.workingDevice.app = app;
		this.deviceTypesForApp = this.deviceTypes.filter(dt => dt.app === app);
		if (this.selectedDeviceType && this.selectedDeviceType.app !== app) this._clearDeviceTypeData();
	}

	handleDeviceTypeSelection(event: any, deviceType: string): void {
		//If we just cleared our device type selection, clear our device type data from the working device and any temp storage
		if (!deviceType) {
			this._clearDeviceTypeData();
			return;
		}
		//Grab the first device type that matches our app and newly selected type
		this.selectedDeviceType = this.deviceTypes.filter(dt => dt.app === this.workingDevice.app && dt.name === deviceType)[0];
		//Set the type on our working device
		this.workingDevice.type = deviceType;
		//Set our fields to whatever's stored or a new object
		this.workingDevice.fields = this.deviceTypeFields[deviceType] = this.deviceTypeFields[deviceType] || this._getDefaultValues(this.selectedDeviceType);
		this._getEncryptedConfirmFields(this.selectedDeviceType);
		this.validationErrors = {};
	}

	handleEncryptedFieldClear(fieldName: string, isChecked: boolean): void {
		this.encryptedFieldsToBeCleared[fieldName] = isChecked;
	}

	private _getEncryptedConfirmFields(deviceType: DeviceType): void {
		this.encryptedConfirmFields = {};
		deviceType.fields.forEach(field => {
			if (field.encrypted) this.encryptedConfirmFields[field.name] = '';
		})
	}

	private _getDefaultValues(deviceType: DeviceType): { [key: string]: any } {
		let out: { [key: string]: any } = {};

		deviceType.fields.forEach(field => {
			if (field.default) out[field.name] = field.default;
			else out[field.name] = null;
		});

		return out;
	}

	private _clearDeviceTypeData(): void {
		this.selectedDeviceType = null;
		this.workingDevice.type = null;
		this.workingDevice.fields = null;
		this.validationErrors = {};
		this.encryptedConfirmFields = {};
	}

	submit(): void {
		if (!this.validate()) return;

		let toSubmit = WorkingDevice.toDevice(this.workingDevice);

		//If device has an ID, device already exists, call update
		if (this.workingDevice.id) {
			let self = this;
			toSubmit.fields.forEach((field, index, array) => {
				const ftype = self.selectedDeviceType.fields.find(ft => ft.name === field.name);
	
				if (!ftype.encrypted) return;
	
				//If we are to be clearing our value, please set it to empty string and return
				if (self.encryptedFieldsToBeCleared[field.name]) field.value = '';
	
				//If our values are null or whitespace, and we're not clearing the existing value, remove the field so it doesn't get overwritten
				else if ((typeof(field.value) === 'string' && !field.value.trim()) ||
					(typeof(field.value) === 'number' && !field.value)) array.splice(index, 1);
			});

			this.devicesService
				.editDevice(toSubmit)
				.then(device => this.activeModal.close({
					device: device,
					isEdit: true
				}))
				.catch(e => this.toastyService.error(e.message));
		}
		else {
			this.devicesService
				.addDevice(toSubmit)
				.then(device => this.activeModal.close({
					device: device,
					isEdit: false
				}))
				.catch(e => this.toastyService.error(e.message));
		}
	}

	isBasicInfoValid(): boolean {
		if (this.workingDevice.name && this.workingDevice.name.trim() && this.workingDevice.app && this.workingDevice.type) return true;

		return false;
	}

	validate(): boolean {
		let self = this;
		this.validationErrors = {};
		let inputs = this.workingDevice.fields;

		//Trim whitespace out of our inputs first
		Object.keys(inputs).forEach(function (key) {
			if (typeof(inputs[key]) === 'string') {
				inputs[key] = (inputs[key] as string).trim();
				//Also trim encrypted confirm fields if necessary
				if (self.encryptedConfirmFields[key]) self.encryptedConfirmFields[key] = self.encryptedConfirmFields[key].trim();
			}
		});

		this.selectedDeviceType.fields.forEach(field => {
			if (field.required) {
				if (inputs[field.name] == null ||
					(typeof inputs[field.name] === 'string' && !inputs[field.name]) ||
					(typeof inputs[field.name] === 'number' && inputs[field.name] === null)) {
					this.validationErrors[field.name] = `You must enter a value for ${field.name}.`
					return;
				}
			}
			switch (field.type) {
				//For strings, check against min/max length, regex pattern, or enum constraints
				case 'string':
					if (inputs[field.name] == null) inputs[field.name] = '';

					if (field.encrypted && !this.encryptedFieldsToBeCleared[field.name] && this.encryptedConfirmFields[field.name] !== inputs[field.name])
						this._concatValidationMessage(field.name, `The values for ${field.name} do not match.`);
					if (field.enum) {
						let enumArray: string[] = field.enum.slice(0);
						if (!field.required) enumArray.push('');
						if (enumArray.indexOf(inputs[field.name]) < 0)
							this._concatValidationMessage(field.name, `You must select a value from the list.`);
					}

					//We're past the required check; Don't do any more validation if we have an empty string as input
					if (!inputs[field.name]) break;

					if (field.minLength !== undefined && inputs[field.name].length < field.minLength)
						this._concatValidationMessage(field.name, `Must be at least ${field.minLength} characters.`);
					if (field.maxLength !== undefined && inputs[field.name].length > field.maxLength)
						this._concatValidationMessage(field.name, `Must be at most ${field.minLength} characters.`);
					if (field.pattern && !new RegExp(<string>field.pattern).test(inputs[field.name]))
						this._concatValidationMessage(field.name, `Input must match a given pattern: ${field.pattern}.`);
					break;
				//For numbers, check against min/max and multipleOf constraints
				case 'number':
				case 'integer':
					//We're past the required check; if number is null, don't do any more validation
					if (inputs[field.name] == null) break;

					let min = this.getMin(field);
					let max = this.getMax(field);
					if (min !== null && inputs[field.name] < min)
						this._concatValidationMessage(field.name, `The minimum value is ${min}.`);
					if (max !== null && inputs[field.name] > max)
						this._concatValidationMessage(field.name, `The maximum value is ${max}.`);
					if (field.multipleOf !== undefined && inputs[field.name] % field.multipleOf)
						this._concatValidationMessage(field.name, `The value must be a multiple of ${field.multipleOf}.`);
					break;
				//For booleans, just initialize the value to false if it doesn't exist
				case 'boolean':
					inputs[field.name] = inputs[field.name] || false;
					break;
			}
		});

		if (Object.keys(this.validationErrors).length) return false;

		return true;
	}

	private _concatValidationMessage(field: string, message: string) {
		if (this.validationErrors[field]) this.validationErrors[field] += '\n' + message;
		else this.validationErrors[field] = message;
	}

	getMin(field: any) {
		if (field.minimum === undefined) return null;
		if (field.exclusiveMinimum) return field.minimum + 1;
		return field.minimum;
	}

	getMax(field: any) {
		if (field.maximum === undefined) return null;
		if (field.exclusiveMaximum) return field.maximum - 1;
		return field.maximum;
	}
}