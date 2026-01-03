/**
 * Finance API Service
 * Handles all financial operations
 * Ready for backend integration
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FinancialTransaction, FinancialSummary } from '../../models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FinanceApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/finance`;

  // Transaction operations
  getAllTransactions(): Observable<FinancialTransaction[]> {
    return this.http.get<FinancialTransaction[]>(`${this.apiUrl}/transactions`);
  }

  getTransactionById(id: string): Observable<FinancialTransaction> {
    return this.http.get<FinancialTransaction>(`${this.apiUrl}/transactions/${id}`);
  }

  createTransaction(transaction: Omit<FinancialTransaction, 'id'>): Observable<FinancialTransaction> {
    return this.http.post<FinancialTransaction>(`${this.apiUrl}/transactions`, transaction);
  }

  // Financial summaries
  getSummary(period: 'daily' | 'weekly' | 'monthly' | 'yearly'): Observable<FinancialSummary> {
    return this.http.get<FinancialSummary>(`${this.apiUrl}/summary`, {
      params: { period }
    });
  }

  getRevenueReport(startDate: string, endDate: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/reports/revenue`, {
      params: { startDate, endDate }
    });
  }

  getExpenseReport(startDate: string, endDate: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/reports/expenses`, {
      params: { startDate, endDate }
    });
  }

  getProfitLossReport(startDate: string, endDate: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/reports/profit-loss`, {
      params: { startDate, endDate }
    });
  }
}
