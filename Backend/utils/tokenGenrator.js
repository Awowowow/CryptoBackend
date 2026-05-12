import crypto from "crypto";

const generateRandomToken =() =>{
    return crypto.randomBytes(32).toString("hex"); 
}

export default generateRandomToken