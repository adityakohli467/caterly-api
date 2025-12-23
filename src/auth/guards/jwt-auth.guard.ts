import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      // Handle token expiration specifically
      if (info && info.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token expired. Please login again.');
      }
      if (info && info.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token. Please login again.');
      }
      throw err || new UnauthorizedException('Invalid or expired token. Please login again.');
    }
    return user;
  }
}

