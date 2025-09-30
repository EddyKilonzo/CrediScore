import { Injectable, Logger } from '@nestjs/common';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  timeout: number;
  resetTimeout: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuits = new Map<
    string,
    {
      state: CircuitState;
      failureCount: number;
      lastFailureTime: number;
      options: CircuitBreakerOptions;
    }
  >();

  private readonly defaultOptions: CircuitBreakerOptions = {
    failureThreshold: 5,
    timeout: 60000, // 1 minute
    resetTimeout: 30000, // 30 seconds
  };

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    circuitName: string,
    operation: () => Promise<T>,
    options?: Partial<CircuitBreakerOptions>,
  ): Promise<T> {
    const circuit = this.getOrCreateCircuit(circuitName, options);

    if (circuit.state === CircuitState.OPEN) {
      if (Date.now() - circuit.lastFailureTime > circuit.options.resetTimeout) {
        circuit.state = CircuitState.HALF_OPEN;
        this.logger.log(
          `Circuit breaker ${circuitName} moved to HALF_OPEN state`,
        );
      } else {
        throw new Error(`Circuit breaker ${circuitName} is OPEN`);
      }
    }

    try {
      const result = await Promise.race([
        operation(),
        this.createTimeoutPromise(circuit.options.timeout),
      ]);

      // Success - reset circuit if it was half-open
      if (circuit.state === CircuitState.HALF_OPEN) {
        circuit.state = CircuitState.CLOSED;
        circuit.failureCount = 0;
        this.logger.log(`Circuit breaker ${circuitName} moved to CLOSED state`);
      }

      return result;
    } catch (error) {
      circuit.failureCount++;
      circuit.lastFailureTime = Date.now();

      if (circuit.failureCount >= circuit.options.failureThreshold) {
        circuit.state = CircuitState.OPEN;
        this.logger.warn(
          `Circuit breaker ${circuitName} moved to OPEN state after ${circuit.failureCount} failures`,
        );
      }

      throw error;
    }
  }

  /**
   * Get circuit state
   */
  getCircuitState(circuitName: string): CircuitState | null {
    const circuit = this.circuits.get(circuitName);
    return circuit ? circuit.state : null;
  }

  /**
   * Reset circuit breaker
   */
  resetCircuit(circuitName: string): void {
    const circuit = this.circuits.get(circuitName);
    if (circuit) {
      circuit.state = CircuitState.CLOSED;
      circuit.failureCount = 0;
      circuit.lastFailureTime = 0;
      this.logger.log(`Circuit breaker ${circuitName} has been reset`);
    }
  }

  /**
   * Get all circuit states
   */
  getAllCircuitStates(): Record<string, CircuitState> {
    const states: Record<string, CircuitState> = {};
    for (const [name, circuit] of this.circuits.entries()) {
      states[name] = circuit.state;
    }
    return states;
  }

  private getOrCreateCircuit(
    circuitName: string,
    options?: Partial<CircuitBreakerOptions>,
  ) {
    let circuit = this.circuits.get(circuitName);

    if (!circuit) {
      circuit = {
        state: CircuitState.CLOSED,
        failureCount: 0,
        lastFailureTime: 0,
        options: { ...this.defaultOptions, ...options },
      };
      this.circuits.set(circuitName, circuit);
    }

    return circuit;
  }

  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Operation timeout'));
      }, timeout);
    });
  }
}
