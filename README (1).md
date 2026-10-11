# IronDesk: Gym Management App on AWS

A full-stack gym management app (members, trainers, payments) built with Node.js and Express, deployed on AWS inside a custom VPC behind an Application Load Balancer.

I built this project to learn how a real application is deployed and secured in the cloud, not only how to write it. The app itself is simple on purpose. The AWS setup around it is the focus.

---

## Architecture

```
                    Internet
                        |
                        v
        +-----------------------------+
        |  Application Load Balancer  |   port 80, spans 2 Availability Zones
        +-----------------------------+
                        |
                        v
        +-----------------------------+
        |        Target group         |   health check: /login.html
        +-----------------------------+
                        |
                        v
        +-----------------------------+
        |   EC2 (Amazon Linux 2023)   |   Node.js app on port 3000
        |   public subnet, VPC        |
        +-----------------------------+
              |                |
              v                v
     +----------------+  +----------------+
     |   CloudWatch   |  |   S3 bucket    |
     |  CPU alarm +   |  |  data backups  |
     |  email alert   |  | (via IAM role) |
     +----------------+  +----------------+
```

## AWS services used

| Service | What I used it for |
|---|---|
| **VPC** | Custom network (10.0.0.0/16) with public and private subnets and an internet gateway |
| **EC2** | Runs the Node.js application on Amazon Linux 2023 |
| **Application Load Balancer** | Receives visitor traffic on port 80 and forwards it to the app, across two Availability Zones |
| **Target group** | Registers the EC2 instance and runs health checks on `/login.html` |
| **Security groups** | The app (port 3000) accepts traffic only from the load balancer's security group. SSH is limited to the VPC, using EC2 Instance Connect Endpoint |
| **CloudWatch + SNS** | Alarm when average CPU stays above 70% for 5 minutes, with an email notification |
| **S3** | Stores backups of the application's `data.json` |
| **IAM role** | The EC2 instance writes to S3 using a role with least-privilege permissions, so no access keys are stored on the server |

## Application features

- Admin login with token-based authentication
- Add, view, renew, and delete members
- Add and delete trainers
- Record and view payments
- Data stored in a JSON file on the server

The app exposes a REST API (Express) that the frontend calls with a login token.

## Project structure

```
irondesk-gym-management/
├── server.js              # Express backend and API
├── login.html             # Login page
├── gym-management.html    # Main app page
├── package.json
└── package-lock.json
```

`data.json` is not stored in this repository because it holds member data. The server creates an empty one automatically on first run.

## How I deployed it on AWS

1. Created a custom VPC with public and private subnets and an internet gateway
2. Launched an EC2 instance in the public subnet and connected with EC2 Instance Connect Endpoint
3. Installed Node.js and Git, cloned this repository, and ran `npm install`
4. Started the app with PM2 so it keeps running after the terminal closes
5. Created a second public subnet in another Availability Zone, then an Application Load Balancer and target group (health check on `/login.html`)
6. Locked the app's port 3000 so only the load balancer's security group can reach it
7. Created a CloudWatch CPU alarm that sends email through SNS
8. Created an S3 bucket and an IAM role with least-privilege access, attached it to the instance, and backed up `data.json` to S3

## Challenges I faced and how I solved them

| Problem | What was happening | How I fixed it |
|---|---|---|
| The load balancer address would not open on my phone | It opened on my laptop and the target group showed Healthy, but my phone's Chrome showed "This site can't be reached" (timed out). The load balancer serves plain HTTP on port 80, and the phone browser most likely blocked or upgraded the unencrypted connection. | Typed `http://` explicitly, then opened the same address in Firefox on the phone, which loaded it. Because the laptop worked, I knew the app and load balancer were fine. The real fix is HTTPS (see next steps). |
| The first server was in the wrong VPC | I launched the EC2 instance into the default VPC, and an instance cannot be moved to another VPC after launch. | Launched a new instance in the public subnet of my custom VPC and stopped using the old one. |
| Browser-based SSH would not connect | The SSH rule only allowed my own IP address, and the browser's Connect button comes from AWS, not from my laptop. | Connected with EC2 Instance Connect Endpoint and allowed SSH from the VPC range (10.0.0.0/16). |
| The app timed out, then said "refused" | A timeout meant the security group was blocking port 3000. After I opened it, "connection refused" meant nothing was listening because the app had stopped. | Added the port 3000 rule, restarted the app, and learned to tell a firewall problem from an app problem. |
| A command failed because of a special character | In the terminal, `&` runs a command in the background, so a password containing `&` split my command in two. | Used letters and numbers only for the password (single quotes also work). |
| My phone opened the app even though the rule said "my IP only" | A rule for one IP address is really my router's public address, which every device on the same Wi-Fi shares. | Learned that "my IP" means one network, not one device, and later restricted port 3000 to the load balancer's security group. |
| The load balancer would not accept one subnet | An Application Load Balancer must span at least two Availability Zones. | Created a second public subnet in ap-south-1b and gave it a route to the internet gateway. |
| Health check design | The app's root address redirects to the login page, which a health check can treat as a failure. | Pointed the health check at `/login.html`. |
| Port 80 vs port 3000 | The app listens on port 3000, but browsers use port 80 for plain HTTP addresses. | The load balancer listens on port 80 and forwards traffic to the app on port 3000. |

## What I learned

- A security group rule names an exact source, so "only my IP" really means one internet address, and the same home network can reach it from several devices
- Why a load balancer needs subnets in two Availability Zones
- "Healthy" in a target group only proves the load balancer can reach the app from inside the VPC, not that every browser can open it
- Using an IAM role instead of access keys keeps credentials off the server
- Why plain HTTP is a problem: the login travels unencrypted

## Limitations and next steps

- [ ] Add HTTPS with a domain name and an AWS Certificate Manager certificate on the load balancer
- [ ] Move the data from a JSON file to a managed database (DynamoDB or RDS), so more than one server can share the same data
- [ ] Schedule the S3 backup automatically with a cron job
- [ ] Hash passwords and replace the single admin account with real user management
- [ ] Define the infrastructure as code with Terraform

## License

This is a learning project. Feel free to read the code and use it as a reference.
