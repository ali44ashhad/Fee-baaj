# install node js
sudo apt update
sudo apt install nodejs
sudo apt install npm
node -v

# add user
useradd -s /bin/bash -m -d /home/jakpro -c "jakpro initial account" jakpro
passwd jakpro
usermod -aG sudo jakpro

# install git
sudo apt-get install git
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
cat ~/.ssh/id_rsa.pub


# install pm2
sudo npm install pm2 -g

# install mongodb
sudo apt-get install gnupg curl
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org