import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import errorHandler from './middleware/errorHandler.js';
import redisClient from './config/redis.js';
import authRouter from './router/auth.js'; 
import cookieParser from "cookie-parser";
const app = express();
import "./services/auth-service/email.service.js"
import userRouter from './router/user.js';
import AppError from './utils/AppError.js';
import { kycRouter } from './router/kyc.js';
import adminRouter from './router/admin.js';
import walletRouter from './router/wallet.js';
import marketRouter from './router/market.js';
import blockchainRouter from './router/blockchain.js';

app.use(cookieParser());
app.use(
    cors({
      origin: ['https://app.cryptoex.me', 'https://cryptoex.me'],
      credentials: true,
    })
  )
app.use((req, res, next) => {
    console.log("👉 Incoming request:", req.method, req.url);
    next();
  });
app.use(cors());
app.use(express.json());



app.use('/auth', authRouter);
app.use("/user", userRouter)
app.use("/kyc", kycRouter)
app.use("/admin", adminRouter)
app.use("/wallet", walletRouter)
app.use("/market", marketRouter)
app.use("/blockchain", blockchainRouter)


app.use((_req, _res, next) => {
    next(new AppError('Route not found', 404));
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
 
const starterServer = async() =>{
    try{
        await redisClient.connect()
        console.log("Redis Connection established");
    app.listen(PORT, () =>{
        console.log(`Server is running on port ${PORT}`);
    });
    }catch(error){ 
        console.log("Startup Failed", error)
        process.exit(1);
    }
}

starterServer()

export default app;
