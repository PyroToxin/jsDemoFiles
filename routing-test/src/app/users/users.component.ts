import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit {

  users = [
    {
      id: 1,
      name: 'Leon'
    },
    {
      id: 2,
      name: 'Anna'
    },
    {
      id: 3,
      name: 'Chris'
    },
    {
      id: 4,
      name: 'Aaron'
    }
  ];

  constructor() { }

  ngOnInit() {
  }

}
