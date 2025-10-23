

## Web app setup

cd webapp

docker build -t ceat-web-app . 

docker run -p 3000:3000 -v $(pwd):/webapp ceat-web-app


## API SETUP ##
cd api

docker build -t ceat web-api .



## Both API + Webapp Setup ##
