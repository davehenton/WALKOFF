import { Component } from '@angular/core';
import { JwtHelper } from 'angular2-jwt';

import { MainService } from './main.service';
import { AuthService } from '../auth/auth.service';

@Component({
	selector: 'main-component',
	templateUrl: 'client/main/main.html',
	styleUrls: [
		'client/main/main.css',
		// 'client/components/main/AdminLTE.css',
		// 'client/components/main/skin-blue.min.css',
		// 'client/node_modules/bootstrap/dist/css/bootstrap.min.css',
		// 'client/node_modules/font-awesome/css/font-awesome.min.css',
	],
	providers: [MainService, AuthService]
})
export class MainComponent {
	currentUser: string;
	apps: string[] = [];
	jwtHelper: JwtHelper = new JwtHelper();

	constructor(private mainService: MainService, private authService: AuthService) {
		this.mainService.getApps()
			.then(apps => this.apps = apps);

		this.updateUserInfo();

		//TODO: remove once we fully convert playbook / triggers to angular
		(<any>window).JwtHelper = this.jwtHelper;
	}

	updateUserInfo(): void {
		let refreshToken = sessionStorage.getItem('refresh_token');
		
		let decoded = this.jwtHelper.decodeToken(refreshToken);

		this.currentUser = decoded.identity;
	}

	logout(): void {
		this.authService.logout()
			.then(() => location.href = '/login')
			.catch(e => console.log(e));
	}
}